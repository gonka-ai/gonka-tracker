# Node API vs Tracker API - Understanding the Difference

## Important Distinction

**`xj7-5.s.filfox.io:19254`** is an **inference node**, not the tracker API. These are different services:

- **Inference Node**: Serves inference requests (`/v1/chat/completions`)
- **Tracker API**: Aggregates and serves network statistics (`/api/v1/inference/current`)

## Node API Endpoints

The node at `xj7-5.s.filfox.io:19254` provides:

### 1. Inference Requests
```bash
# Make inference requests
curl -X POST "http://xj7-5.s.filfox.io:19254/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"model": "Qwen/Qwen2.5-7B-Instruct", "messages": [...]}'
```

### 2. Health Check
```bash
curl "http://xj7-5.s.filfox.io:19254/health"
```

### 3. Management Endpoints (if available)
```bash
# Start inference service
curl -X POST "http://xj7-5.s.filfox.io:19254/api/v1/inference/up" \
  -H "Content-Type: application/json" \
  -d '{"model": "Qwen/Qwen2.5-7B-Instruct", "dtype": "float16"}'

# Stop inference service
curl -X POST "http://xj7-5.s.filfox.io:19254/api/v1/inference/down"
```

**The node does NOT have `/api/v1/inference/current`** - that's a tracker endpoint.

## Tracker API Endpoints

The **gonka-tracker** service (running separately) provides:

### Base URLs:
- **Local tracker**: `http://localhost/api/v1`
- **Direct backend**: `http://localhost:8000/v1` (if exposed)

### Check Inference Activity:
```bash
# Use the TRACKER API, not the node
curl -s "http://localhost/api/v1/inference/current" | jq
```

## How to Check Inference Activity on Your Testnet

### Option 1: Use Local Tracker (If Running)

If you have the gonka-tracker running locally:

```bash
# Check current epoch stats
curl -s "http://localhost/api/v1/inference/current" | jq '.participants[] | {
  address: .address,
  inference_count: .current_epoch_stats.inference_count,
  validated: .current_epoch_stats.validated_inferences
}'
```

### Option 2: Query Chain Directly Through Node

Nodes can proxy to the chain API. Try:

```bash
# Get participants stats from chain
curl -s "http://xj7-5.s.filfox.io:19254/chain-api/productscience/inference/inference/get_all_participant_current_stats" | jq

# Or if the node has chain-api proxy
curl -s "http://xj7-5.s.filfox.io:19254/chain-api/productscience/inference/inference/participants_stats" | jq
```

### Option 3: Use Decentralized Public API

If there's a public decentralized API:

```bash
# Check if there's a public API endpoint
curl -s "https://api.gonka.ai/v1/participants" | jq
```

### Option 4: Direct Chain RPC (If Node Exposes It)

```bash
# Query chain RPC directly
curl -s "http://xj7-5.s.filfox.io:19254/chain-rpc/abci_query?path=\"/productscience.inference.inference.Query/GetAllParticipantCurrentStats\"" | jq
```

## Quick Check: What Endpoints Does the Node Have?

Test what the node actually serves:

```bash
# Check health
curl "http://xj7-5.s.filfox.io:19254/health"

# Try common endpoints
curl "http://xj7-5.s.filfox.io:19254/v1/status" 2>/dev/null
curl "http://xj7-5.s.filfox.io:19254/api/v1/status" 2>/dev/null
curl "http://xj7-5.s.filfox.io:19254/chain-api/productscience/inference/inference/get_all_participant_current_stats" 2>/dev/null
```

## Recommended Approach

**For checking inference activity on your testnet:**

1. **If you have tracker running locally:**
   ```bash
   curl -s "http://localhost/api/v1/inference/current" | jq '.participants[].current_epoch_stats.inference_count'
   ```

2. **If you need to query through the node:**
   - Check if node proxies chain API
   - Use chain RPC endpoints
   - Or set up your own tracker pointing to your testnet

3. **For making inference requests:**
   ```bash
   # Use the node URL
   curl -X POST "http://xj7-5.s.filfox.io:19254/v1/chat/completions" ...
   ```

## Summary

| Service | URL | Purpose | Example Endpoint |
|---------|-----|---------|-----------------|
| **Inference Node** | `xj7-5.s.filfox.io:19254` | Serve inference requests | `/v1/chat/completions` |
| **Tracker API** | `http://localhost/api/v1` | Network statistics | `/api/v1/inference/current` |
| **Chain API** | Via node proxy | Blockchain queries | `/chain-api/...` |

**The error `{"error":"Not Found"}` is expected** - the node doesn't have the tracker's `/api/v1/inference/current` endpoint.
