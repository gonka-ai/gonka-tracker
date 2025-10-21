export interface CurrentEpochStats {
  inference_count: string;
  missed_requests: string;
  earned_coins: string;
  rewarded_coins: string;
  burned_coins: string;
  validated_inferences: string;
  invalidated_inferences: string;
}

export interface Participant {
  index: string;
  address: string;
  weight: number;
  validator_key?: string;
  inference_url?: string;
  status?: string;
  models: string[];
  current_epoch_stats: CurrentEpochStats;
  missed_rate: number;
  invalidation_rate: number;
  is_jailed?: boolean;
  jailed_until?: string;
  ready_to_unjail?: boolean;
  node_healthy?: boolean;
  node_health_checked_at?: string;
  moniker?: string;
  identity?: string;
  keybase_username?: string;
  keybase_picture_url?: string;
  website?: string;
  validator_consensus_key?: string;
  consensus_key_mismatch?: boolean;
}

export interface InferenceResponse {
  epoch_id: number;
  height: number;
  participants: Participant[];
  cached_at?: string;
  is_current: boolean;
  total_assigned_rewards_gnk?: number;
}

export interface RewardInfo {
  epoch_id: number;
  assigned_reward_gnk: number;
  claimed: boolean;
}

export interface SeedInfo {
  participant: string;
  epoch_index: number;
  signature: string;
}

export interface WarmKeyInfo {
  grantee_address: string;
  granted_at: string;
}

export interface HardwareInfo {
  type: string;
  count: number;
}

export interface MLNodeInfo {
  local_id: string;
  status: string;
  models: string[];
  hardware: HardwareInfo[];
  host: string;
  port: string;
  poc_weight?: number;
}

export interface ParticipantDetailsResponse {
  participant: Participant;
  rewards: RewardInfo[];
  seed: SeedInfo | null;
  warm_keys: WarmKeyInfo[];
  ml_nodes: MLNodeInfo[];
}

export interface BlockInfo {
  height: number;
  timestamp: string;
}

export interface TimelineEvent {
  block_height: number;
  description: string;
  occurred: boolean;
}

export interface TimelineResponse {
  current_block: BlockInfo;
  reference_block: BlockInfo;
  avg_block_time: number;
  events: TimelineEvent[];
  current_epoch_start: number;
  current_epoch_index: number;
  epoch_length: number;
}

export interface ModelInfo {
  id: string;
  total_weight: number;
  participant_count: number;
  proposed_by: string;
  v_ram: string;
  throughput_per_nonce: string;
  units_of_compute_per_token: string;
  hf_repo: string;
  hf_commit: string;
  model_args: string[];
  validation_threshold: {
    value: string;
    exponent: number;
  };
}

export interface ModelStats {
  model: string;
  ai_tokens: string;
  inferences: number;
}

export interface ModelsResponse {
  epoch_id: number;
  height: number;
  models: ModelInfo[];
  stats: ModelStats[];
  cached_at: string;
  is_current: boolean;
}

