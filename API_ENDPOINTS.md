# Gonka Tracker API Endpoints

This document provides curl commands to manually query the main API endpoints of the Gonka Tracker backend.

## Base URL

- **Via Traefik (production)**: `http://localhost/api/v1`
- **Direct backend access**: `http://localhost:8000/v1` (if backend is exposed directly)

## Main API Endpoints

### 1. Health Check
Simple endpoint to verify the API is running.

```bash
curl -X GET "http://localhost/api/v1/hello"
```

**Expected Response:**
```json
{
  "message": "hello"
}
```

---

### 2. Current Epoch Inference Statistics
Get real-time inference statistics for the current epoch.

```bash
# Get cached current epoch stats
curl -X GET "http://localhost/api/v1/inference/current"

# Force reload from chain (bypass cache)
curl -X GET "http://localhost/api/v1/inference/current?reload=true"
```

**Response includes:**
- `epoch_id`: Current epoch ID
- `height`: Block height
- `participants`: List of all participants with their stats
- `cached_at`: Timestamp when data was cached
- `is_current`: Boolean indicating if this is the current epoch
- `total_assigned_rewards_gnk`: Total rewards assigned
- `current_block_height`: Current block height
- `current_block_timestamp`: Current block timestamp
- `avg_block_time`: Average block time
- `next_poc_start_block`: Next proof-of-compute start block
- `set_new_validators_block`: Block when new validators are set

---

### 3. Historical Epoch Inference Statistics
Get inference statistics for a specific historical epoch.

```bash
# Get stats for epoch 1
curl -X GET "http://localhost/api/v1/inference/epochs/1"

# Get stats for epoch 5 at specific height
curl -X GET "http://localhost/api/v1/inference/epochs/5?height=12345"
```

**Parameters:**
- `epoch_id` (path): Epoch ID (must be >= 1)
- `height` (query, optional): Specific block height (must be >= 1)

---

### 4. Participant Details
Get detailed information about a specific participant in an epoch.

```bash
# Get details for participant "gonka1abc..." in epoch 1
curl -X GET "http://localhost/api/v1/participants/gonka1abc123def456?epoch_id=1"

# Get details at specific height
curl -X GET "http://localhost/api/v1/participants/gonka1abc123def456?epoch_id=1&height=12345"
```

**Parameters:**
- `participant_id` (path): Participant address/ID
- `epoch_id` (query, required): Epoch ID (must be >= 1)
- `height` (query, optional): Specific block height (must be >= 1)

**Response includes:**
- `participant`: Full participant stats (index, address, weight, validator_key, inference_url, status, models, stats, jail status, node health, etc.)
- `rewards`: List of reward information
- `seed`: Seed information (if available)
- `warm_keys`: List of warm key grants
- `ml_nodes`: List of ML nodes information

---

### 5. Timeline
Get timeline information showing epoch events and block progression.

```bash
curl -X GET "http://localhost/api/v1/timeline"
```

**Response includes:**
- `current_block`: Current block info (height, timestamp)
- `reference_block`: Reference block info
- `avg_block_time`: Average block time
- `events`: List of timeline events (block_height, description, occurred)
- `current_epoch_start`: Block height when current epoch started
- `current_epoch_index`: Current epoch index
- `epoch_length`: Length of epoch in blocks
- `epoch_stages`: Current epoch stage information
- `next_epoch_stages`: Next epoch stage information

---

### 6. Current Models
Get information about models supported in the current epoch.

```bash
curl -X GET "http://localhost/api/v1/models/current"
```

**Response includes:**
- `epoch_id`: Current epoch ID
- `height`: Block height
- `models`: List of model information (id, total_weight, participant_count, proposed_by, v_ram, throughput_per_nonce, units_of_compute_per_token, hf_repo, hf_commit, model_args, validation_threshold)
- `stats`: List of model statistics (model, ai_tokens, inferences)
- `cached_at`: Timestamp when data was cached
- `is_current`: Boolean indicating if this is current data
- `current_block_timestamp`: Current block timestamp
- `avg_block_time`: Average block time

---

### 7. Historical Models
Get information about models supported in a specific historical epoch.

```bash
# Get models for epoch 1
curl -X GET "http://localhost/api/v1/models/epochs/1"

# Get models for epoch 5 at specific height
curl -X GET "http://localhost/api/v1/models/epochs/5?height=12345"
```

**Parameters:**
- `epoch_id` (path): Epoch ID (must be >= 1)
- `height` (query, optional): Specific block height (must be >= 1)

---

### 8. Participant Inferences
Get detailed inference information for a specific participant in an epoch.

```bash
# Get inferences for participant "gonka1abc..." in epoch 1
curl -X GET "http://localhost/api/v1/participants/gonka1abc123def456/inferences?epoch_id=1"
```

**Parameters:**
- `participant_id` (path): Participant address/ID
- `epoch_id` (query, required): Epoch ID (must be >= 1)

**Response includes:**
- `epoch_id`: Epoch ID
- `participant_id`: Participant ID
- `successful`: List of successful inference details
- `expired`: List of expired inference details
- `invalidated`: List of invalidated inference details
- `cached_at`: Timestamp when data was cached

Each inference detail includes:
- `inference_id`: Unique inference ID
- `status`: Inference status
- `start_block_height`: Block height when inference started
- `start_block_timestamp`: Timestamp when inference started
- `validated_by`: List of validators who validated this inference
- `prompt_hash`: Hash of the prompt
- `response_hash`: Hash of the response
- `prompt_payload`: Prompt payload (if available)
- `response_payload`: Response payload (if available)
- `prompt_token_count`: Number of prompt tokens
- `completion_token_count`: Number of completion tokens
- `model`: Model used

---

## Pretty Print JSON Responses

To format JSON responses for better readability, pipe through `jq`:

```bash
curl -X GET "http://localhost/api/v1/inference/current" | jq
```

Or use Python:

```bash
curl -X GET "http://localhost/api/v1/inference/current" | python3 -m json.tool
```

---

## Error Responses

All endpoints may return the following error responses:

- **400 Bad Request**: Invalid parameters (e.g., epoch_id < 1, height < 1)
- **404 Not Found**: Resource not found (e.g., participant not in epoch)
- **500 Internal Server Error**: Server-side error
- **503 Service Unavailable**: Service not initialized

Example error response:
```json
{
  "detail": "Participant gonka1abc123def456 not found in epoch 1"
}
```

---

## Example Usage Workflow

1. **Check API health:**
   ```bash
   curl -X GET "http://localhost/api/v1/hello"
   ```

2. **Get current epoch stats:**
   ```bash
   curl -X GET "http://localhost/api/v1/inference/current" | jq
   ```

3. **Get timeline to see current epoch:**
   ```bash
   curl -X GET "http://localhost/api/v1/timeline" | jq
   ```

4. **Get current models:**
   ```bash
   curl -X GET "http://localhost/api/v1/models/current" | jq
   ```

5. **Get details for a specific participant (replace with actual participant ID from step 2):**
   ```bash
   curl -X GET "http://localhost/api/v1/participants/gonka1abc123def456?epoch_id=1" | jq
   ```

6. **Get historical epoch stats:**
   ```bash
   curl -X GET "http://localhost/api/v1/inference/epochs/1" | jq
   ```

---

## Note on gRPC

This API is a **REST API** (FastAPI), not gRPC. Therefore, `grpcurl` commands are not applicable. Use `curl` or any HTTP client to interact with these endpoints.
