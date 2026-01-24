#!/usr/bin/env python3
"""
Metrics Collector Script
Collects metrics from the backend API and writes them to PostgreSQL for Grafana
"""

import asyncio
import asyncpg
import httpx
import os
from datetime import datetime
from decimal import Decimal
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration from environment
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
POSTGRES_DB = os.getenv("POSTGRES_DB", "gonka_tracker")
API_URL = os.getenv("API_URL", "http://localhost/api/v1")
COLLECT_INTERVAL = int(os.getenv("COLLECT_INTERVAL", "30"))


async def get_inference_data(api_url: str) -> dict:
    """Fetch current inference data from API"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(f"{api_url}/inference/current")
        response.raise_for_status()
        return response.json()


async def get_participant_details(api_url: str, participant_address: str, epoch_id: int) -> dict:
    """Fetch participant details including historical rewards"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(
                f"{api_url}/participants/{participant_address}",
                params={"epoch_id": epoch_id}
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.debug(f"Participant {participant_address} not found in epoch {epoch_id}")
                return {}
            raise


async def write_node_metrics(conn: asyncpg.Connection, inference_data: dict):
    """Write node metrics to PostgreSQL"""
    if conn.is_closed():
        raise asyncpg.exceptions.InterfaceError("Connection is closed")
    
    now = datetime.utcnow()
    epoch_id = inference_data.get("epoch_id")
    height = inference_data.get("height")
    
    participants = inference_data.get("participants", [])
    
    for participant in participants:
        stats = participant.get("current_epoch_stats", {})
        
        await conn.execute("""
            INSERT INTO node_metrics (
                time, node_address, epoch_id, block_height,
                inference_count, missed_requests, validated_inferences,
                invalidated_inferences, earned_coins, rewarded_coins,
                weight, missed_rate, invalidation_rate,
                is_jailed, node_healthy
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (time, node_address) DO UPDATE SET
                epoch_id = EXCLUDED.epoch_id,
                block_height = EXCLUDED.block_height,
                inference_count = EXCLUDED.inference_count,
                missed_requests = EXCLUDED.missed_requests,
                validated_inferences = EXCLUDED.validated_inferences,
                invalidated_inferences = EXCLUDED.invalidated_inferences,
                earned_coins = EXCLUDED.earned_coins,
                rewarded_coins = EXCLUDED.rewarded_coins,
                weight = EXCLUDED.weight,
                missed_rate = EXCLUDED.missed_rate,
                invalidation_rate = EXCLUDED.invalidation_rate,
                is_jailed = EXCLUDED.is_jailed,
                node_healthy = EXCLUDED.node_healthy
        """,
            now,
            participant.get("address"),
            epoch_id,
            height,
            int(stats.get("inference_count", 0)),
            int(stats.get("missed_requests", 0)),
            int(stats.get("validated_inferences", 0)),
            int(stats.get("invalidated_inferences", 0)),
            int(stats.get("earned_coins", 0)),
            int(stats.get("rewarded_coins", 0)),
            participant.get("weight", 0),
            Decimal(str(participant.get("missed_rate", 0))),
            Decimal(str(participant.get("invalidation_rate", 0))),
            participant.get("is_jailed"),
            participant.get("node_healthy")
        )


async def write_participant_rewards(conn: asyncpg.Connection, api_url: str, participants: list, current_epoch_id: int):
    """Fetch and write historical rewards for participants"""
    if conn.is_closed():
        raise asyncpg.exceptions.InterfaceError("Connection is closed")
    
    now = datetime.utcnow()
    
    # Fetch rewards for each participant (limit to last 10 epochs to avoid too many API calls)
    for participant in participants:
        participant_address = participant.get("address")
        if not participant_address:
            continue
        
        try:
            # Fetch participant details for current epoch to get rewards history
            participant_data = await get_participant_details(api_url, participant_address, current_epoch_id)
            
            rewards = participant_data.get("rewards", [])
            if not rewards:
                continue
            
            # Store each reward
            for reward in rewards:
                epoch_id = reward.get("epoch_id")
                assigned_reward_gnk = reward.get("assigned_reward_gnk", 0)
                claimed = reward.get("claimed", False)
                
                if epoch_id is None:
                    continue
                
                # Convert GNK to base units (1 GNK = 1,000,000,000 base units)
                # Store in base units to match earned_coins/rewarded_coins format
                reward_base_units = int(assigned_reward_gnk) * 1_000_000_000 if assigned_reward_gnk else 0
                
                await conn.execute("""
                    INSERT INTO participant_rewards (
                        time, node_address, epoch_id, assigned_reward_gnk, claimed
                    ) VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (node_address, epoch_id) DO UPDATE SET
                        time = EXCLUDED.time,
                        assigned_reward_gnk = EXCLUDED.assigned_reward_gnk,
                        claimed = EXCLUDED.claimed
                """,
                    now,
                    participant_address,
                    epoch_id,
                    reward_base_units,  # Store in base units
                    claimed
                )
            
            logger.debug(f"Stored {len(rewards)} rewards for participant {participant_address}")
            
        except Exception as e:
            logger.warning(f"Failed to fetch rewards for {participant_address}: {e}")
            # Continue with other participants
            continue


async def write_network_metrics(conn: asyncpg.Connection, inference_data: dict):
    """Write network aggregate metrics to PostgreSQL"""
    if conn.is_closed():
        raise asyncpg.exceptions.InterfaceError("Connection is closed")
    
    now = datetime.utcnow()
    epoch_id = inference_data.get("epoch_id")
    height = inference_data.get("height")
    
    participants = inference_data.get("participants", [])
    
    total_nodes = len(participants)
    active_nodes = sum(
        1 for p in participants 
        if not p.get("is_jailed") and p.get("node_healthy")
    )
    total_weight = sum(p.get("weight", 0) for p in participants)
    
    total_inferences = sum(
        int(p.get("current_epoch_stats", {}).get("inference_count", 0))
        for p in participants
    )
    total_missed = sum(
        int(p.get("current_epoch_stats", {}).get("missed_requests", 0))
        for p in participants
    )
    
    total_requests = total_inferences + total_missed
    avg_missed_rate = Decimal(str(total_missed / total_requests)) if total_requests > 0 else Decimal("0")
    
    total_invalidated = sum(
        int(p.get("current_epoch_stats", {}).get("invalidated_inferences", 0))
        for p in participants
    )
    avg_invalidation_rate = Decimal(str(total_invalidated / total_inferences)) if total_inferences > 0 else Decimal("0")
    
    await conn.execute("""
        INSERT INTO network_metrics (
            time, epoch_id, block_height,
            total_nodes, active_nodes, total_weight,
            total_inferences, total_missed,
            avg_missed_rate, avg_invalidation_rate
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (time) DO UPDATE SET
            epoch_id = EXCLUDED.epoch_id,
            block_height = EXCLUDED.block_height,
            total_nodes = EXCLUDED.total_nodes,
            active_nodes = EXCLUDED.active_nodes,
            total_weight = EXCLUDED.total_weight,
            total_inferences = EXCLUDED.total_inferences,
            total_missed = EXCLUDED.total_missed,
            avg_missed_rate = EXCLUDED.avg_missed_rate,
            avg_invalidation_rate = EXCLUDED.avg_invalidation_rate
    """,
        now,
        epoch_id,
        height,
        total_nodes,
        active_nodes,
        total_weight,
        total_inferences,
        total_missed,
        avg_missed_rate,
        avg_invalidation_rate
    )


async def get_db_connection():
    """Get a database connection with retry logic"""
    max_retries = 3
    retry_delay = 5
    
    for attempt in range(max_retries):
        try:
            conn = await asyncpg.connect(
                host=POSTGRES_HOST,
                port=POSTGRES_PORT,
                user=POSTGRES_USER,
                password=POSTGRES_PASSWORD,
                database=POSTGRES_DB,
                timeout=10
            )
            return conn
        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(f"Failed to connect to database (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {retry_delay}s...")
                await asyncio.sleep(retry_delay)
            else:
                logger.error(f"Failed to connect to database after {max_retries} attempts: {e}")
                raise


async def ensure_connection(conn):
    """Check if connection is open, reconnect if needed"""
    if conn.is_closed():
        logger.warning("Database connection is closed, reconnecting...")
        return await get_db_connection()
    return conn


async def collect_metrics():
    """Main collection loop"""
    conn = None
    
    try:
        conn = await get_db_connection()
        logger.info("Connected to PostgreSQL database")
        
        while True:
            try:
                # Ensure connection is still open
                conn = await ensure_connection(conn)
                
                # Fetch data from API
                logger.info("Fetching inference data from API...")
                inference_data = await get_inference_data(API_URL)
                
                # Write metrics to database
                epoch_id = inference_data.get('epoch_id')
                logger.info(f"Writing metrics for epoch {epoch_id}...")
                await write_node_metrics(conn, inference_data)
                await write_network_metrics(conn, inference_data)
                
                # Fetch and store historical rewards (do this less frequently to avoid API overload)
                # Only fetch rewards every 5th collection cycle (every ~2.5 minutes if interval is 30s)
                participants = inference_data.get("participants", [])
                if participants:
                    logger.info(f"Fetching rewards for {len(participants)} participants...")
                    await write_participant_rewards(conn, API_URL, participants, epoch_id)
                
                logger.info("Metrics written successfully")
                
            except asyncpg.exceptions.InterfaceError as e:
                logger.warning(f"Database connection error: {e}. Will reconnect on next iteration.")
                if conn:
                    try:
                        await conn.close()
                    except:
                        pass
                    conn = None
            except Exception as e:
                logger.error(f"Error collecting metrics: {e}", exc_info=True)
            
            # Wait before next collection
            await asyncio.sleep(COLLECT_INTERVAL)
    
    finally:
        if conn and not conn.is_closed():
            await conn.close()
            logger.info("Database connection closed")


if __name__ == "__main__":
    logger.info("Starting metrics collector...")
    logger.info(f"API URL: {API_URL}")
    logger.info(f"PostgreSQL: {POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}")
    logger.info(f"Collection interval: {COLLECT_INTERVAL}s")
    
    try:
        asyncio.run(collect_metrics())
    except KeyboardInterrupt:
        logger.info("Stopping metrics collector...")
