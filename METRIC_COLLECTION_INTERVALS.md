# Metric Collection Intervals and Server Impact

## Current Metric Collection Intervals

### Primary Metrics Collection (Writes to PostgreSQL)

**Current Epoch Stats Polling: 30 seconds**
- **What it does**: Fetches current epoch participant statistics from Gonka Chain API
- **Metrics written**: 
  - `node_metrics` (per-node time-series data)
  - `network_metrics` (aggregate network statistics)
- **API calls made**:
  - `/v1/epochs/current/participants` (1 call)
  - `/chain-rpc/block` (2-3 calls for height calculations)
  - `/chain-rpc/status` (1 call)
- **Impact**: This is the **primary metric collection point** - writes happen every 30 seconds

### Secondary Data Collection

**Jail Status: 120 seconds (2 minutes)**
- Fetches validator jail status
- API calls: `/chain-api/cosmos/staking/v1beta1/validators`
- **No metrics written** (only cache updates)

**Node Health: 60 seconds (1 minute)**
- Checks health of inference nodes
- API calls: Direct HTTP requests to participant inference URLs
- **No metrics written** (only cache updates)

**Rewards: 60 seconds (1 minute)**
- Fetches participant rewards data
- API calls: `/chain-api/productscience/inference/inference/epoch_performance_summary/{epoch}/{participant}`
- **Metrics written**: `participant_rewards_metrics` (when rewards are fetched)

**Other Polling Tasks** (less frequent, no metrics):
- Warm keys: 300 seconds (5 minutes)
- Hardware nodes: 600 seconds (10 minutes)
- Epoch total rewards: 600 seconds (10 minutes)
- Participant inferences: 1200 seconds (20 minutes)
- Models API: 300 seconds (5 minutes)
- Timeline: 30 seconds
- Confirmation data: 120 seconds (2 minutes)
- Block height monitoring: 30 seconds

## Server Impact Analysis

### Request Frequency

**Per 30-second cycle (primary metrics collection):**
- ~5-6 API requests to Gonka Chain nodes
- 1 request to get current participants
- 2-3 requests for block height data
- 1 request for chain status

**Total requests per minute:**
- Primary metrics: ~10-12 requests/minute
- Jail status: ~0.5 requests/minute
- Node health: ~N requests/minute (where N = number of participants, typically 3)
- Rewards: ~N requests/minute (where N = number of participants)
- Other tasks: Negligible (< 1 request/minute combined)

**Estimated total: ~20-30 requests/minute** to Gonka Chain API servers

### Impact on Gonka Chain Servers

#### ✅ Low Impact Factors

1. **Read-only operations**: All requests are GET requests (no writes)
2. **Cached endpoints**: Many endpoints are designed for frequent polling
3. **Reasonable intervals**: 30 seconds is standard for monitoring systems
4. **Single tracker instance**: Only one instance is polling (not distributed)

#### ⚠️ Considerations

1. **Participant health checks**: Direct HTTP requests to inference nodes (every 60s per node)
   - If you have 10 participants, that's 10 requests/minute to their inference servers
   - These are lightweight health checks, but still add up

2. **Rewards polling**: Individual API calls per participant (every 60s per participant)
   - If you have 10 participants, that's 10 requests/minute
   - Some may return 404 if rewards aren't available yet

3. **Peak load**: During epoch transitions, additional requests may be made

### Comparison: Before vs After Unified Backend

**Before (with collector script):**
- Backend polling: Same intervals (unchanged)
- Collector script: Additional polling every 30-60 seconds
- **Total impact**: Higher (duplicate requests)

**After (unified backend):**
- Backend polling: Same intervals (unchanged)
- Metrics written: Directly from backend (no separate collector)
- **Total impact**: Lower (no duplicate requests)

**Result**: The unified backend actually **reduces** server load by eliminating the separate collector script that was making duplicate API calls.

## Recommendations

### If You Need to Reduce Server Load

1. **Increase primary polling interval** (if 30s is too frequent):
   ```bash
   POLL_CURRENT_EPOCH_INTERVAL=60  # Change to 60 seconds
   ```

2. **Increase node health check interval**:
   ```bash
   POLL_NODE_HEALTH_INTERVAL=120  # Change to 2 minutes
   ```

3. **Increase rewards polling interval**:
   ```bash
   POLL_REWARDS_INTERVAL=120  # Change to 2 minutes
   ```

4. **Disable non-essential polling** (if not needed):
   - Warm keys, hardware nodes, inferences can be polled less frequently

### If You Need More Frequent Metrics

1. **Decrease primary polling interval** (not recommended below 15s):
   ```bash
   POLL_CURRENT_EPOCH_INTERVAL=15  # Minimum recommended: 15 seconds
   ```

2. **Note**: More frequent polling increases server load and may hit rate limits

### Current Configuration (Default)

The current 30-second interval for primary metrics is a **good balance**:
- ✅ Frequent enough for real-time monitoring
- ✅ Not so frequent as to cause significant server load
- ✅ Standard practice for monitoring systems
- ✅ Allows Grafana to show near real-time data

## Monitoring Your Impact

You can monitor the impact by:

1. **Check request logs** on Gonka Chain servers (if you have access)
2. **Monitor error rates**: If you see 429 (rate limit) or 503 errors, reduce polling frequency
3. **Check Grafana metrics**: If metrics are updating smoothly, current intervals are fine

## Summary

- **Primary metrics collection**: Every 30 seconds (writes to PostgreSQL)
- **Total server requests**: ~20-30 requests/minute (reasonable for monitoring)
- **Impact**: Low to moderate (read-only, cached endpoints, single instance)
- **Unified backend benefit**: Actually reduces load by eliminating duplicate collector requests
- **Recommendation**: Current intervals are well-balanced; adjust only if you see issues
