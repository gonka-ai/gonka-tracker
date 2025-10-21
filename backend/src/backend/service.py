import asyncio
import logging
import time
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from backend.client import GonkaClient
from backend.database import CacheDB
from backend.models import (
    ParticipantStats,
    CurrentEpochStats,
    InferenceResponse,
    RewardInfo,
    SeedInfo,
    ParticipantDetailsResponse,
    WarmKeyInfo,
    HardwareInfo,
    MLNodeInfo,
    BlockInfo,
    TimelineEvent,
    TimelineResponse,
    ModelInfo,
    ModelStats,
    ModelsResponse
)

logger = logging.getLogger(__name__)


def _extract_ml_nodes_map(ml_nodes_data: List[Dict]) -> Dict[str, int]:
    result = {}
    for wrapper in ml_nodes_data:
        for node in wrapper.get("ml_nodes", []):
            node_id = node.get("node_id")
            if node_id:
                poc_weight = node.get("poc_weight")
                if poc_weight is not None:
                    result[node_id] = poc_weight
    return result


class InferenceService:
    def __init__(self, client: GonkaClient, cache_db: CacheDB):
        self.client = client
        self.cache_db = cache_db
        self.current_epoch_id: Optional[int] = None
        self.current_epoch_data: Optional[InferenceResponse] = None
        self.last_fetch_time: Optional[float] = None
    
    async def get_canonical_height(self, epoch_id: int, requested_height: Optional[int] = None) -> int:
        latest_info = await self.client.get_latest_epoch()
        current_epoch_id = latest_info["latest_epoch"]["index"]
        
        if epoch_id == current_epoch_id:
            current_height = await self.client.get_latest_height()
            return requested_height if requested_height else current_height
        
        epoch_data = await self.client.get_epoch_participants(epoch_id)
        effective_height = epoch_data["active_participants"]["effective_block_height"]
        
        try:
            next_epoch_data = await self.client.get_epoch_participants(epoch_id + 1)
            next_effective_height = next_epoch_data["active_participants"]["effective_block_height"]
            canonical_height = next_effective_height - 10
        except Exception:
            canonical_height = latest_info["epoch_stages"]["next_poc_start"] - 10
        
        if requested_height is None:
            return canonical_height
        
        if requested_height < effective_height:
            raise ValueError(
                f"Height {requested_height} is before epoch {epoch_id} start (effective height: {effective_height}). "
                f"No data exists for this epoch at this height."
            )
        
        if requested_height >= canonical_height:
            logger.info(f"Height {requested_height} is after epoch {epoch_id} end. "
                      f"Clamping to canonical height {canonical_height}")
            return canonical_height
        
        return requested_height
    
    async def get_current_epoch_stats(self, reload: bool = False) -> InferenceResponse:
        current_time = time.time()
        cache_age = (current_time - self.last_fetch_time) if self.last_fetch_time else None
        
        if not reload and self.current_epoch_data and cache_age and cache_age < 300:
            logger.info(f"Returning cached current epoch data (age: {cache_age:.1f}s)")
            return self.current_epoch_data
        
        try:
            logger.info("Fetching fresh current epoch data")
            height = await self.client.get_latest_height()
            epoch_data = await self.client.get_current_epoch_participants()
            
            epoch_id = epoch_data["active_participants"]["epoch_group_id"]
            
            await self._mark_epoch_finished_if_needed(epoch_id, height)
            
            all_participants_data = await self.client.get_all_participants(height=height)
            participants_list = all_participants_data.get("participant", [])
            
            active_indices = {
                p["index"] for p in epoch_data["active_participants"]["participants"]
            }
            
            epoch_participant_data = {
                p["index"]: {
                    "weight": p.get("weight", 0),
                    "models": p.get("models", []),
                    "validator_key": p.get("validator_key"),
                    "seed_signature": p.get("seed", {}).get("signature"),
                    "ml_nodes_map": _extract_ml_nodes_map(p.get("ml_nodes", []))
                }
                for p in epoch_data["active_participants"]["participants"]
            }
            
            active_participants = [
                p for p in participants_list if p["index"] in active_indices
            ]
            
            participants_stats = []
            stats_for_saving = []
            for p in active_participants:
                try:
                    epoch_data_for_participant = epoch_participant_data.get(p["index"], {})
                    
                    participant = ParticipantStats(
                        index=p["index"],
                        address=p["address"],
                        weight=epoch_data_for_participant.get("weight", 0),
                        validator_key=epoch_data_for_participant.get("validator_key"),
                        inference_url=p.get("inference_url"),
                        status=p.get("status"),
                        models=epoch_data_for_participant.get("models", []),
                        current_epoch_stats=CurrentEpochStats(**p["current_epoch_stats"])
                    )
                    participants_stats.append(participant)
                    
                    stats_dict = p.copy()
                    stats_dict["weight"] = epoch_data_for_participant.get("weight", 0)
                    stats_dict["models"] = epoch_data_for_participant.get("models", [])
                    stats_dict["validator_key"] = epoch_data_for_participant.get("validator_key")
                    stats_dict["seed_signature"] = epoch_data_for_participant.get("seed_signature")
                    stats_dict["_ml_nodes_map"] = epoch_data_for_participant.get("ml_nodes_map", {})
                    stats_for_saving.append(stats_dict)
                except Exception as e:
                    logger.warning(f"Failed to parse participant {p.get('index', 'unknown')}: {e}")
            
            active_participants_list = epoch_data["active_participants"]["participants"]
            participants_stats = await self.merge_jail_and_health_data(epoch_id, participants_stats, height, active_participants_list)
            
            response = InferenceResponse(
                epoch_id=epoch_id,
                height=height,
                participants=participants_stats,
                cached_at=datetime.utcnow().isoformat(),
                is_current=True
            )
            
            await self.cache_db.save_stats_batch(
                epoch_id=epoch_id,
                height=height,
                participants_stats=stats_for_saving
            )
            
            self.current_epoch_id = epoch_id
            self.current_epoch_data = response
            self.last_fetch_time = current_time
            
            asyncio.create_task(self._ensure_participant_caches(epoch_id, participants_stats))
            
            logger.info(f"Fetched current epoch {epoch_id} stats at height {height}: {len(participants_stats)} participants")
            
            return response
            
        except Exception as e:
            logger.error(f"Error fetching current epoch stats: {e}")
            if self.current_epoch_data:
                logger.info("Returning cached current epoch data due to error")
                return self.current_epoch_data
            raise
    
    async def get_historical_epoch_stats(self, epoch_id: int, height: Optional[int] = None, calculate_rewards_sync: bool = False) -> InferenceResponse:
        is_finished = await self.cache_db.is_epoch_finished(epoch_id)
        
        try:
            target_height = await self.get_canonical_height(epoch_id, height)
        except Exception as e:
            logger.error(f"Failed to determine target height for epoch {epoch_id}: {e}")
            raise
        
        cached_stats = await self.cache_db.get_stats(epoch_id, height=target_height)
        if cached_stats:
            logger.info(f"Returning cached stats for epoch {epoch_id} at height {target_height}")
            
            participants_stats = []
            for stats_dict in cached_stats:
                try:
                    stats_copy = dict(stats_dict)
                    stats_copy.pop("_cached_at", None)
                    stats_copy.pop("_height", None)
                    
                    participant = ParticipantStats(**stats_copy)
                    participants_stats.append(participant)
                except Exception as e:
                    logger.warning(f"Failed to parse cached participant: {e}")
            
            epoch_data = await self.client.get_epoch_participants(epoch_id)
            active_participants_list = epoch_data["active_participants"]["participants"]
            participants_stats = await self.merge_jail_and_health_data(epoch_id, participants_stats, target_height, active_participants_list)
            
            total_rewards_gnk = await self.cache_db.get_epoch_total_rewards(epoch_id)
            if total_rewards_gnk is None or total_rewards_gnk == 0:
                if total_rewards_gnk == 0:
                    logger.warning(f"Detected invalid cached total rewards (0 GNK) for epoch {epoch_id}, deleting and recalculating")
                    await self.cache_db.delete_epoch_total_rewards(epoch_id)
                
                if calculate_rewards_sync:
                    logger.info(f"Calculating total rewards synchronously for epoch {epoch_id}")
                    await self._calculate_and_cache_total_rewards(epoch_id)
                    total_rewards_gnk = await self.cache_db.get_epoch_total_rewards(epoch_id)
                else:
                    asyncio.create_task(self._calculate_and_cache_total_rewards(epoch_id))
            
            asyncio.create_task(self._ensure_participant_caches(epoch_id, participants_stats))
            
            return InferenceResponse(
                epoch_id=epoch_id,
                height=target_height,
                participants=participants_stats,
                cached_at=cached_stats[0].get("_cached_at"),
                is_current=False,
                total_assigned_rewards_gnk=total_rewards_gnk
            )
        
        try:
            logger.info(f"Fetching historical epoch {epoch_id} at height {target_height}")
            
            all_participants_data = await self.client.get_all_participants(height=target_height)
            participants_list = all_participants_data.get("participant", [])
            
            epoch_data = await self.client.get_epoch_participants(epoch_id)
            active_indices = {
                p["index"] for p in epoch_data["active_participants"]["participants"]
            }
            
            epoch_participant_data = {
                p["index"]: {
                    "weight": p.get("weight", 0),
                    "models": p.get("models", []),
                    "validator_key": p.get("validator_key"),
                    "seed_signature": p.get("seed", {}).get("signature"),
                    "ml_nodes_map": _extract_ml_nodes_map(p.get("ml_nodes", []))
                }
                for p in epoch_data["active_participants"]["participants"]
            }
            
            active_participants = [
                p for p in participants_list if p["index"] in active_indices
            ]
            
            participants_stats = []
            stats_for_saving = []
            for p in active_participants:
                try:
                    epoch_data_for_participant = epoch_participant_data.get(p["index"], {})
                    
                    participant = ParticipantStats(
                        index=p["index"],
                        address=p["address"],
                        weight=epoch_data_for_participant.get("weight", 0),
                        validator_key=epoch_data_for_participant.get("validator_key"),
                        inference_url=p.get("inference_url"),
                        status=p.get("status"),
                        models=epoch_data_for_participant.get("models", []),
                        current_epoch_stats=CurrentEpochStats(**p["current_epoch_stats"])
                    )
                    participants_stats.append(participant)
                    
                    stats_dict = p.copy()
                    stats_dict["weight"] = epoch_data_for_participant.get("weight", 0)
                    stats_dict["models"] = epoch_data_for_participant.get("models", [])
                    stats_dict["validator_key"] = epoch_data_for_participant.get("validator_key")
                    stats_dict["seed_signature"] = epoch_data_for_participant.get("seed_signature")
                    stats_dict["_ml_nodes_map"] = epoch_data_for_participant.get("ml_nodes_map", {})
                    stats_for_saving.append(stats_dict)
                except Exception as e:
                    logger.warning(f"Failed to parse participant {p.get('index', 'unknown')}: {e}")
            
            await self.cache_db.save_stats_batch(
                epoch_id=epoch_id,
                height=target_height,
                participants_stats=stats_for_saving
            )
            
            if height is None and not is_finished:
                await self.cache_db.mark_epoch_finished(epoch_id, target_height)
            
            participants_stats = await self.merge_jail_and_health_data(epoch_id, participants_stats, target_height, epoch_data["active_participants"]["participants"])
            
            total_rewards_gnk = await self.cache_db.get_epoch_total_rewards(epoch_id)
            if total_rewards_gnk is None:
                asyncio.create_task(self._calculate_and_cache_total_rewards(epoch_id))
            
            response = InferenceResponse(
                epoch_id=epoch_id,
                height=target_height,
                participants=participants_stats,
                cached_at=datetime.utcnow().isoformat(),
                is_current=False,
                total_assigned_rewards_gnk=total_rewards_gnk
            )
            
            asyncio.create_task(self._ensure_participant_caches(epoch_id, participants_stats))
            
            logger.info(f"Fetched and cached historical epoch {epoch_id} at height {target_height}: {len(participants_stats)} participants")
            
            return response
            
        except Exception as e:
            logger.error(f"Error fetching historical epoch {epoch_id}: {e}")
            raise
    
    async def _mark_epoch_finished_if_needed(self, current_epoch_id: int, current_height: int):
        if self.current_epoch_id is None:
            return
        
        if current_epoch_id > self.current_epoch_id:
            old_epoch_id = self.current_epoch_id
            is_already_finished = await self.cache_db.is_epoch_finished(old_epoch_id)
            
            if not is_already_finished:
                logger.info(f"Epoch transition detected: {old_epoch_id} -> {current_epoch_id}")
                
                try:
                    await self.get_historical_epoch_stats(old_epoch_id, calculate_rewards_sync=True)
                    logger.info(f"Marked epoch {old_epoch_id} as finished and cached final stats with total rewards")
                except Exception as e:
                    logger.error(f"Failed to mark epoch {old_epoch_id} as finished: {e}")
    
    async def fetch_and_cache_jail_statuses(self, epoch_id: int, height: int, active_participants: List[Dict[str, Any]]):
        try:
            validators = await self.client.get_all_validators(height=height)
            validators_with_tokens = [v for v in validators if v.get("tokens") and int(v.get("tokens")) > 0]
            
            active_indices = {p["index"] for p in active_participants}
            participant_map = {p["index"]: p for p in active_participants}
            
            validator_by_operator = {}
            for v in validators_with_tokens:
                operator_address = v.get("operator_address", "")
                if operator_address:
                    validator_by_operator[operator_address] = v
            
            jail_statuses = []
            now_utc = datetime.now(timezone.utc)
            
            for participant_index in active_indices:
                participant = participant_map.get(participant_index)
                if not participant:
                    continue
                
                valoper_address = self.client.convert_bech32_address(participant_index, "gonkavaloper")
                if not valoper_address:
                    continue
                
                validator = validator_by_operator.get(valoper_address)
                if not validator:
                    continue
                
                consensus_pub = (
                    (validator.get("consensus_pubkey") or {}).get("key")
                    or (validator.get("consensus_pubkey") or {}).get("value")
                    or ""
                )
                
                participant_validator_key = participant.get("validator_key", "")
                
                consensus_key_mismatch = False
                if consensus_pub and participant_validator_key:
                    consensus_key_mismatch = consensus_pub != participant_validator_key
                
                is_jailed = bool(validator.get("jailed"))
                valcons_addr = self.client.pubkey_to_valcons(consensus_pub) if consensus_pub else None
                
                jailed_until = None
                ready_to_unjail = False
                
                if is_jailed and valcons_addr:
                    signing_info = await self.client.get_signing_info(valcons_addr, height=height)
                    if signing_info:
                        jailed_until_str = signing_info.get("jailed_until")
                        if jailed_until_str and "1970-01-01" not in jailed_until_str:
                            jailed_until = jailed_until_str
                            try:
                                jailed_until_dt = datetime.fromisoformat(jailed_until_str.replace("Z", "")).replace(tzinfo=timezone.utc)
                                ready_to_unjail = now_utc > jailed_until_dt
                            except Exception:
                                pass
                
                description = validator.get("description", {})
                moniker = description.get("moniker", "").strip()
                identity = description.get("identity", "").strip()
                website = description.get("website", "").strip()
                
                if moniker and moniker.startswith("gonkavaloper"):
                    moniker = ""
                
                keybase_username = None
                keybase_picture_url = None
                if identity:
                    keybase_username, keybase_picture_url = await self.client.get_keybase_info(identity)
                
                jail_statuses.append({
                    "participant_index": participant_index,
                    "is_jailed": is_jailed,
                    "jailed_until": jailed_until,
                    "ready_to_unjail": ready_to_unjail,
                    "valcons_address": valcons_addr,
                    "moniker": moniker if moniker else None,
                    "identity": identity if identity else None,
                    "keybase_username": keybase_username,
                    "keybase_picture_url": keybase_picture_url,
                    "website": website if website else None,
                    "validator_consensus_key": consensus_pub if consensus_pub else None,
                    "consensus_key_mismatch": consensus_key_mismatch if consensus_pub and participant_validator_key else None
                })
            
            await self.cache_db.save_jail_status_batch(epoch_id, jail_statuses)
            logger.info(f"Cached jail statuses for {len(jail_statuses)} participants in epoch {epoch_id}")
            
        except Exception as e:
            logger.error(f"Failed to fetch and cache jail statuses: {e}")
    
    async def fetch_and_cache_node_health(self, active_participants: List[Dict[str, Any]]):
        try:
            health_statuses = []
            
            for participant in active_participants:
                participant_index = participant.get("index")
                inference_url = participant.get("inference_url")
                
                if not participant_index:
                    continue
                
                health_result = await self.client.check_node_health(inference_url)
                
                health_statuses.append({
                    "participant_index": participant_index,
                    "is_healthy": health_result["is_healthy"],
                    "error_message": health_result["error_message"],
                    "response_time_ms": health_result["response_time_ms"]
                })
            
            await self.cache_db.save_node_health_batch(health_statuses)
            logger.info(f"Cached health statuses for {len(health_statuses)} participants")
            
        except Exception as e:
            logger.error(f"Failed to fetch and cache node health: {e}")
    
    async def merge_jail_and_health_data(self, epoch_id: int, participants: List[ParticipantStats], height: int, active_participants: List[Dict[str, Any]]) -> List[ParticipantStats]:
        try:
            jail_statuses_list = await self.cache_db.get_jail_status(epoch_id)
            jail_map = {}
            if jail_statuses_list:
                jail_map = {j["participant_index"]: j for j in jail_statuses_list}
            else:
                logger.info(f"No cached jail statuses for epoch {epoch_id}, fetching inline")
                await self.fetch_and_cache_jail_statuses(epoch_id, height, active_participants)
                jail_statuses_list = await self.cache_db.get_jail_status(epoch_id)
                if jail_statuses_list:
                    jail_map = {j["participant_index"]: j for j in jail_statuses_list}
            
            health_statuses_list = await self.cache_db.get_node_health()
            health_map = {}
            if health_statuses_list:
                health_map = {h["participant_index"]: h for h in health_statuses_list}
            else:
                logger.info("No cached health statuses, fetching inline")
                await self.fetch_and_cache_node_health(active_participants)
                health_statuses_list = await self.cache_db.get_node_health()
                if health_statuses_list:
                    health_map = {h["participant_index"]: h for h in health_statuses_list}
            
            for participant in participants:
                jail_info = jail_map.get(participant.index)
                if jail_info:
                    participant.is_jailed = jail_info["is_jailed"]
                    participant.jailed_until = jail_info["jailed_until"]
                    participant.ready_to_unjail = jail_info["ready_to_unjail"]
                    participant.moniker = jail_info.get("moniker")
                    participant.identity = jail_info.get("identity")
                    participant.keybase_username = jail_info.get("keybase_username")
                    participant.keybase_picture_url = jail_info.get("keybase_picture_url")
                    participant.website = jail_info.get("website")
                    participant.validator_consensus_key = jail_info.get("validator_consensus_key")
                    participant.consensus_key_mismatch = jail_info.get("consensus_key_mismatch")
                
                health_info = health_map.get(participant.index)
                if health_info:
                    participant.node_healthy = health_info["is_healthy"]
                    participant.node_health_checked_at = health_info["last_check"]
            
            return participants
            
        except Exception as e:
            logger.error(f"Failed to merge jail and health data: {e}")
            return participants
    
    async def get_participant_details(
        self,
        participant_id: str,
        epoch_id: int,
        height: Optional[int] = None
    ) -> Optional[ParticipantDetailsResponse]:
        try:
            latest_info = await self.client.get_latest_epoch()
            current_epoch_id = latest_info["latest_epoch"]["index"]
            is_current = (epoch_id == current_epoch_id)
            
            if is_current:
                stats = await self.get_current_epoch_stats()
            else:
                stats = await self.get_historical_epoch_stats(epoch_id, height)
            
            participant = None
            for p in stats.participants:
                if p.index == participant_id:
                    participant = p
                    break
            
            if not participant:
                return None
            
            if epoch_id == current_epoch_id:
                epoch_ids = [current_epoch_id - i for i in range(1, 6) if current_epoch_id - i > 0]
            elif epoch_id < current_epoch_id:
                epoch_ids = [epoch_id - i for i in range(5, -1, -1) if epoch_id - i > 0]
            else:
                epoch_ids = []
            
            rewards = []
            if epoch_ids:
                rewards_data = await self.cache_db.get_rewards_for_participant(participant_id, epoch_ids)
                cached_epoch_ids = {r["epoch_id"] for r in rewards_data}
                
                missing_epoch_ids = [eid for eid in epoch_ids if eid not in cached_epoch_ids]
                
                if missing_epoch_ids:
                    logger.info(f"Fetching missing rewards inline for epochs {missing_epoch_ids}")
                    newly_fetched = []
                    for missing_epoch in missing_epoch_ids:
                        try:
                            summary = await self.client.get_epoch_performance_summary(
                                missing_epoch,
                                participant_id
                            )
                            perf = summary.get("epochPerformanceSummary", {})
                            reward_data = {
                                "epoch_id": missing_epoch,
                                "participant_id": participant_id,
                                "rewarded_coins": perf.get("rewarded_coins", "0"),
                                "claimed": perf.get("claimed", False)
                            }
                            rewards_data.append(reward_data)
                            newly_fetched.append(reward_data)
                        except Exception as e:
                            logger.debug(f"Could not fetch reward for epoch {missing_epoch}: {e}")
                    
                    if newly_fetched:
                        await self.cache_db.save_reward_batch(newly_fetched)
                        logger.info(f"Cached {len(newly_fetched)} inline-fetched rewards")
                
                for reward_data in rewards_data:
                    rewarded_coins = reward_data.get("rewarded_coins", "0")
                    gnk = int(rewarded_coins) // 1_000_000_000 if rewarded_coins != "0" else 0
                    
                    rewards.append(RewardInfo(
                        epoch_id=reward_data["epoch_id"],
                        assigned_reward_gnk=gnk,
                        claimed=reward_data["claimed"]
                    ))
                
                rewards.sort(key=lambda r: r.epoch_id, reverse=True)
            
            seed = None
            cached_stats = await self.cache_db.get_stats(epoch_id, height)
            if cached_stats:
                for s in cached_stats:
                    if s.get("index") == participant_id:
                        seed_sig = s.get("_seed_signature")
                        if seed_sig:
                            seed = SeedInfo(
                                participant=participant_id,
                                epoch_index=epoch_id,
                                signature=seed_sig
                            )
                        break
            
            warm_keys_data = await self.cache_db.get_warm_keys(epoch_id, participant_id)
            
            if warm_keys_data is None:
                logger.info(f"Fetching warm keys inline for participant {participant_id}")
                try:
                    warm_keys_raw = await self.client.get_authz_grants(participant_id)
                    if warm_keys_raw:
                        await self.cache_db.save_warm_keys_batch(epoch_id, participant_id, warm_keys_raw)
                        warm_keys_data = warm_keys_raw
                    else:
                        warm_keys_data = []
                except Exception as e:
                    logger.warning(f"Failed to fetch warm keys for {participant_id}: {e}")
                    warm_keys_data = []
            
            warm_keys = [
                WarmKeyInfo(
                    grantee_address=wk["grantee_address"],
                    granted_at=wk["granted_at"]
                )
                for wk in (warm_keys_data or [])
            ]
            
            hardware_nodes_data = await self.cache_db.get_hardware_nodes(epoch_id, participant_id)
            
            if hardware_nodes_data is None:
                logger.info(f"Fetching hardware nodes inline for participant {participant_id}")
                try:
                    hardware_nodes_raw = await self.client.get_hardware_nodes(participant_id)
                    if hardware_nodes_raw:
                        await self.cache_db.save_hardware_nodes_batch(epoch_id, participant_id, hardware_nodes_raw)
                        hardware_nodes_data = hardware_nodes_raw
                    else:
                        hardware_nodes_data = []
                except Exception as e:
                    logger.warning(f"Failed to fetch hardware nodes for {participant_id}: {e}")
                    hardware_nodes_data = []
            
            ml_nodes_map = {}
            cached_stats = await self.cache_db.get_stats(epoch_id, height)
            if cached_stats:
                for s in cached_stats:
                    if s.get("index") == participant_id:
                        ml_nodes_map = s.get("_ml_nodes_map", {})
                        break
            
            ml_nodes = []
            for node in (hardware_nodes_data or []):
                local_id = node.get("local_id", "")
                poc_weight = ml_nodes_map.get(local_id) or node.get("poc_weight")
                
                hardware_list = [
                    HardwareInfo(type=hw["type"], count=hw["count"])
                    for hw in node.get("hardware", [])
                ]
                ml_nodes.append(MLNodeInfo(
                    local_id=local_id,
                    status=node.get("status", ""),
                    models=node.get("models", []),
                    hardware=hardware_list,
                    host=node.get("host", ""),
                    port=node.get("port", ""),
                    poc_weight=poc_weight
                ))
            
            return ParticipantDetailsResponse(
                participant=participant,
                rewards=rewards,
                seed=seed,
                warm_keys=warm_keys,
                ml_nodes=ml_nodes
            )
            
        except Exception as e:
            logger.error(f"Failed to get participant details: {e}")
            return None
    
    async def poll_participant_rewards(self):
        try:
            logger.info("Polling participant rewards")
            
            height = await self.client.get_latest_height()
            epoch_data = await self.client.get_current_epoch_participants()
            current_epoch = epoch_data["active_participants"]["epoch_group_id"]
            participants = epoch_data["active_participants"]["participants"]
            
            rewards_to_save = []
            
            for participant in participants:
                participant_id = participant["index"]
                
                for epoch_offset in range(1, 7):
                    check_epoch = current_epoch - epoch_offset
                    if check_epoch <= 0:
                        continue
                    
                    cached_reward = await self.cache_db.get_reward(check_epoch, participant_id)
                    if cached_reward and cached_reward["claimed"]:
                        continue
                    
                    try:
                        summary = await self.client.get_epoch_performance_summary(
                            check_epoch,
                            participant_id,
                            height=height
                        )
                        
                        perf = summary.get("epochPerformanceSummary", {})
                        rewarded_coins = perf.get("rewarded_coins", "0")
                        claimed = perf.get("claimed", False)
                        
                        rewards_to_save.append({
                            "epoch_id": check_epoch,
                            "participant_id": participant_id,
                            "rewarded_coins": rewarded_coins,
                            "claimed": claimed
                        })
                        
                    except Exception as e:
                        logger.debug(f"Failed to fetch reward for {participant_id} epoch {check_epoch}: {e}")
                        continue
            
            if rewards_to_save:
                await self.cache_db.save_reward_batch(rewards_to_save)
                logger.info(f"Saved {len(rewards_to_save)} reward records")
            
        except Exception as e:
            logger.error(f"Error polling participant rewards: {e}")
    
    async def poll_warm_keys(self):
        try:
            logger.info("Polling warm keys")
            
            epoch_data = await self.client.get_current_epoch_participants()
            current_epoch = epoch_data["active_participants"]["epoch_group_id"]
            participants = epoch_data["active_participants"]["participants"]
            
            for participant in participants:
                participant_id = participant["index"]
                
                try:
                    warm_keys = await self.client.get_authz_grants(participant_id)
                    await self.cache_db.save_warm_keys_batch(current_epoch, participant_id, warm_keys)
                    logger.debug(f"Updated {len(warm_keys)} warm keys for {participant_id}")
                except Exception as e:
                    logger.debug(f"Failed to fetch warm keys for {participant_id}: {e}")
                    continue
            
            logger.info(f"Completed warm keys polling for {len(participants)} participants")
            
        except Exception as e:
            logger.error(f"Error polling warm keys: {e}")
    
    async def poll_hardware_nodes(self):
        try:
            logger.info("Polling hardware nodes")
            
            epoch_data = await self.client.get_current_epoch_participants()
            current_epoch = epoch_data["active_participants"]["epoch_group_id"]
            participants = epoch_data["active_participants"]["participants"]
            
            for participant in participants:
                participant_id = participant["index"]
                
                try:
                    hardware_nodes = await self.client.get_hardware_nodes(participant_id)
                    await self.cache_db.save_hardware_nodes_batch(current_epoch, participant_id, hardware_nodes)
                    logger.debug(f"Updated {len(hardware_nodes)} hardware nodes for {participant_id}")
                except Exception as e:
                    logger.debug(f"Failed to fetch hardware nodes for {participant_id}: {e}")
                    continue
            
            logger.info(f"Completed hardware nodes polling for {len(participants)} participants")
            
        except Exception as e:
            logger.error(f"Error polling hardware nodes: {e}")
    
    async def _calculate_and_cache_total_rewards(self, epoch_id: int):
        try:
            logger.info(f"Calculating total assigned rewards for epoch {epoch_id}")
            
            epoch_data = await self.client.get_epoch_participants(epoch_id)
            participants = epoch_data["active_participants"]["participants"]
            
            total_ugnk = 0
            fetched_count = 0
            rewards_batch = []
            participants_with_rewards = 0
            
            for participant in participants:
                participant_id = participant["index"]
                
                try:
                    summary = await self.client.get_epoch_performance_summary(
                        epoch_id,
                        participant_id
                    )
                    perf = summary.get("epochPerformanceSummary", {})
                    rewarded_coins = perf.get("rewarded_coins", "0")
                    rewarded_amount = int(rewarded_coins)
                    total_ugnk += rewarded_amount
                    fetched_count += 1
                    
                    if rewarded_amount > 0:
                        participants_with_rewards += 1
                    
                    rewards_batch.append({
                        "epoch_id": epoch_id,
                        "participant_id": participant_id,
                        "rewarded_coins": rewarded_coins,
                        "claimed": perf.get("claimed", False)
                    })
                except Exception as e:
                    logger.debug(f"Could not fetch reward for {participant_id} in epoch {epoch_id}: {e}")
                    continue
            
            if total_ugnk == 0 and fetched_count > 0:
                logger.warning(f"Epoch {epoch_id} rewards calculation returned 0 for all {fetched_count} participants - rewards may not be available yet, skipping cache")
                return
            
            if rewards_batch:
                await self.cache_db.save_reward_batch(rewards_batch)
                logger.debug(f"Cached {len(rewards_batch)} participant rewards during total calculation")
            
            total_gnk = total_ugnk // 1_000_000_000
            
            await self.cache_db.save_epoch_total_rewards(epoch_id, total_gnk)
            logger.info(f"Calculated and cached total rewards for epoch {epoch_id}: {total_gnk} GNK from {fetched_count}/{len(participants)} participants ({participants_with_rewards} with rewards)")
            
        except Exception as e:
            logger.error(f"Error calculating epoch total rewards for epoch {epoch_id}: {e}")
    
    async def poll_epoch_total_rewards(self):
        try:
            logger.info("Polling epoch total rewards")
            
            latest_info = await self.client.get_latest_epoch()
            current_epoch_id = latest_info["latest_epoch"]["index"]
            
            for offset in range(1, 6):
                epoch_id = current_epoch_id - offset
                if epoch_id <= 0:
                    continue
                
                cached_total = await self.cache_db.get_epoch_total_rewards(epoch_id)
                if cached_total is not None and cached_total > 0:
                    logger.debug(f"Epoch {epoch_id} total rewards already cached: {cached_total} GNK")
                    continue
                
                if cached_total == 0:
                    logger.warning(f"Detected invalid cached total rewards (0 GNK) for epoch {epoch_id}, recalculating")
                    await self.cache_db.delete_epoch_total_rewards(epoch_id)
                
                logger.info(f"Calculating total rewards for epoch {epoch_id}")
                await self._calculate_and_cache_total_rewards(epoch_id)
            
            logger.info("Completed epoch total rewards polling")
            
        except Exception as e:
            logger.error(f"Error polling epoch total rewards: {e}")
    
    async def _ensure_participant_caches(self, epoch_id: int, participants: List[ParticipantStats]):
        try:
            logger.info(f"Ensuring participant caches for epoch {epoch_id} ({len(participants)} participants)")
            
            for participant in participants:
                participant_id = participant.index
                
                cached_reward = await self.cache_db.get_reward(epoch_id, participant_id)
                if cached_reward is None:
                    try:
                        summary = await self.client.get_epoch_performance_summary(epoch_id, participant_id)
                        perf = summary.get("epochPerformanceSummary", {})
                        await self.cache_db.save_reward_batch([{
                            "epoch_id": epoch_id,
                            "participant_id": participant_id,
                            "rewarded_coins": perf.get("rewarded_coins", "0"),
                            "claimed": perf.get("claimed", False)
                        }])
                        logger.debug(f"Cached reward for {participant_id} in epoch {epoch_id}")
                    except Exception as e:
                        logger.debug(f"Failed to cache reward for {participant_id}: {e}")
                
                cached_warm_keys = await self.cache_db.get_warm_keys(epoch_id, participant_id)
                if cached_warm_keys is None:
                    try:
                        warm_keys = await self.client.get_authz_grants(participant_id)
                        await self.cache_db.save_warm_keys_batch(epoch_id, participant_id, warm_keys)
                        logger.debug(f"Cached {len(warm_keys)} warm keys for {participant_id}")
                    except Exception as e:
                        logger.debug(f"Failed to cache warm keys for {participant_id}: {e}")
                
                cached_hardware = await self.cache_db.get_hardware_nodes(epoch_id, participant_id)
                if cached_hardware is None:
                    try:
                        hardware_nodes = await self.client.get_hardware_nodes(participant_id)
                        await self.cache_db.save_hardware_nodes_batch(epoch_id, participant_id, hardware_nodes)
                        logger.debug(f"Cached {len(hardware_nodes)} hardware nodes for {participant_id}")
                    except Exception as e:
                        logger.debug(f"Failed to cache hardware nodes for {participant_id}: {e}")
            
            logger.info(f"Completed participant cache population for epoch {epoch_id}")
            
        except Exception as e:
            logger.error(f"Error ensuring participant caches: {e}")
    
    async def get_timeline(self):
        current_height = await self.client.get_latest_height()
        current_block_data = await self.client.get_block(current_height)
        current_timestamp = current_block_data["result"]["block"]["header"]["time"]
        
        reference_height = current_height - 10000
        reference_block_data = await self.client.get_block(reference_height)
        reference_timestamp = reference_block_data["result"]["block"]["header"]["time"]
        
        current_dt = datetime.fromisoformat(current_timestamp.replace('Z', '+00:00'))
        reference_dt = datetime.fromisoformat(reference_timestamp.replace('Z', '+00:00'))
        
        time_diff_seconds = (current_dt - reference_dt).total_seconds()
        block_diff = current_height - reference_height
        avg_block_time = round(time_diff_seconds / block_diff, 2)
        
        restrictions_data = await self.client.get_restrictions_params()
        restrictions_end_block = int(restrictions_data["params"]["restriction_end_block"])
        
        latest_epoch_info = await self.client.get_latest_epoch()
        current_epoch_start = latest_epoch_info["latest_epoch"]["poc_start_block_height"]
        current_epoch_index = latest_epoch_info["latest_epoch"]["index"]
        epoch_length = latest_epoch_info["epoch_params"]["epoch_length"]
        
        events = [
            TimelineEvent(
                block_height=restrictions_end_block,
                description="Money Transfer Enabled",
                occurred=current_height >= restrictions_end_block
            )
        ]
        
        return TimelineResponse(
            current_block=BlockInfo(height=current_height, timestamp=current_timestamp),
            reference_block=BlockInfo(height=reference_height, timestamp=reference_timestamp),
            avg_block_time=avg_block_time,
            events=events,
            current_epoch_start=current_epoch_start,
            current_epoch_index=current_epoch_index,
            epoch_length=epoch_length
        )
    
    async def get_current_models(self) -> ModelsResponse:
        epoch_data = await self.client.get_current_epoch_participants()
        epoch_id = epoch_data["active_participants"]["epoch_group_id"]
        participants = epoch_data["active_participants"]["participants"]
        height = await self.client.get_latest_height()
        
        cached_models = await self.cache_db.get_models(epoch_id)
        
        if cached_models:
            logger.info(f"Returning cached models for epoch {epoch_id}")
        else:
            logger.info(f"Fetching and aggregating models for epoch {epoch_id}")
            
            model_weights: Dict[str, int] = {}
            model_participant_count: Dict[str, set] = {}
            
            for participant in participants:
                participant_index = participant["index"]
                models = participant.get("models", [])
                ml_nodes_high_level = participant.get("ml_nodes", [])
                
                for model, ml_nodes_entry in zip(models, ml_nodes_high_level):
                    if model not in model_weights:
                        model_weights[model] = 0
                        model_participant_count[model] = set()
                    
                    for ml_node in ml_nodes_entry.get("ml_nodes", []):
                        poc_weight = ml_node.get("poc_weight", 0)
                        model_weights[model] += poc_weight
                    
                    model_participant_count[model].add(participant_index)
            
            models_to_cache = []
            for model_id in model_weights:
                models_to_cache.append({
                    "model_id": model_id,
                    "total_weight": model_weights[model_id],
                    "participant_count": len(model_participant_count[model_id])
                })
            
            if models_to_cache:
                await self.cache_db.save_models_batch(epoch_id, models_to_cache)
            
            cached_models = models_to_cache
        
        models_stats_data = await self.client.get_models_stats()
        stats_list = models_stats_data.get("stats_models", [])
        
        models_all_data = await self.client.get_models_all()
        models_list = models_all_data.get("model", [])
        
        models_dict = {m["id"]: m for m in models_list}
        cached_dict = {m["model_id"]: m for m in cached_models} if cached_models else {}
        
        models_info = []
        for model in models_list:
            model_id = model["id"]
            cached = cached_dict.get(model_id, {})
            
            models_info.append(ModelInfo(
                id=model_id,
                total_weight=cached.get("total_weight", 0),
                participant_count=cached.get("participant_count", 0),
                proposed_by=model.get("proposed_by", ""),
                v_ram=model.get("v_ram", ""),
                throughput_per_nonce=model.get("throughput_per_nonce", ""),
                units_of_compute_per_token=model.get("units_of_compute_per_token", ""),
                hf_repo=model.get("hf_repo", ""),
                hf_commit=model.get("hf_commit", ""),
                model_args=model.get("model_args", []),
                validation_threshold=model.get("validation_threshold", {})
            ))
        
        stats_info = []
        for stat in stats_list:
            stats_info.append(ModelStats(
                model=stat.get("model", ""),
                ai_tokens=stat.get("ai_tokens", "0"),
                inferences=stat.get("inferences", 0)
            ))
        
        return ModelsResponse(
            epoch_id=epoch_id,
            height=height,
            models=models_info,
            stats=stats_info,
            cached_at=datetime.utcnow().isoformat(),
            is_current=True
        )
    
    async def get_historical_models(self, epoch_id: int, height: Optional[int] = None) -> ModelsResponse:
        epoch_data = await self.client.get_epoch_participants(epoch_id)
        participants = epoch_data["active_participants"]["participants"]
        target_height = await self.get_canonical_height(epoch_id, height)
        
        cached_models = await self.cache_db.get_models(epoch_id)
        
        if cached_models:
            logger.info(f"Returning cached models for epoch {epoch_id}")
        else:
            logger.info(f"Fetching and aggregating models for epoch {epoch_id}")
            
            model_weights: Dict[str, int] = {}
            model_participant_count: Dict[str, set] = {}
            
            for participant in participants:
                participant_index = participant["index"]
                models = participant.get("models", [])
                ml_nodes_high_level = participant.get("ml_nodes", [])
                
                for model, ml_nodes_entry in zip(models, ml_nodes_high_level):
                    if model not in model_weights:
                        model_weights[model] = 0
                        model_participant_count[model] = set()
                    
                    for ml_node in ml_nodes_entry.get("ml_nodes", []):
                        poc_weight = ml_node.get("poc_weight", 0)
                        model_weights[model] += poc_weight
                    
                    model_participant_count[model].add(participant_index)
            
            models_to_cache = []
            for model_id in model_weights:
                models_to_cache.append({
                    "model_id": model_id,
                    "total_weight": model_weights[model_id],
                    "participant_count": len(model_participant_count[model_id])
                })
            
            if models_to_cache:
                await self.cache_db.save_models_batch(epoch_id, models_to_cache)
            
            cached_models = models_to_cache
        
        models_stats_data = await self.client.get_models_stats()
        stats_list = models_stats_data.get("stats_models", [])
        
        models_all_data = await self.client.get_models_all()
        models_list = models_all_data.get("model", [])
        
        models_dict = {m["id"]: m for m in models_list}
        cached_dict = {m["model_id"]: m for m in cached_models} if cached_models else {}
        
        models_info = []
        for model in models_list:
            model_id = model["id"]
            cached = cached_dict.get(model_id, {})
            
            models_info.append(ModelInfo(
                id=model_id,
                total_weight=cached.get("total_weight", 0),
                participant_count=cached.get("participant_count", 0),
                proposed_by=model.get("proposed_by", ""),
                v_ram=model.get("v_ram", ""),
                throughput_per_nonce=model.get("throughput_per_nonce", ""),
                units_of_compute_per_token=model.get("units_of_compute_per_token", ""),
                hf_repo=model.get("hf_repo", ""),
                hf_commit=model.get("hf_commit", ""),
                model_args=model.get("model_args", []),
                validation_threshold=model.get("validation_threshold", {})
            ))
        
        stats_info = []
        for stat in stats_list:
            stats_info.append(ModelStats(
                model=stat.get("model", ""),
                ai_tokens=stat.get("ai_tokens", "0"),
                inferences=stat.get("inferences", 0)
            ))
        
        return ModelsResponse(
            epoch_id=epoch_id,
            height=target_height,
            models=models_info,
            stats=stats_info,
            cached_at=datetime.utcnow().isoformat(),
            is_current=False
        )

