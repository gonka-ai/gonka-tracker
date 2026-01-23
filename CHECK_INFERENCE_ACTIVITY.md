# How to Check Inference Activity on Testnet Nodes

This guide shows multiple ways to check if there has been inference activity on your testnet nodes.

## Method 1: Check Current Epoch Stats (Quick Overview)

Get a quick summary of inference activity for all participants in the current epoch:

```bash
# Get current epoch stats with inference counts
curl -s "http://localhost/api/v1/inference/current" | jq '.participants[] | {
  address: .address,
  inference_count: .current_epoch_stats.inference_count,
  validated: .current_epoch_stats.validated_inferences,
  invalidated: .current_epoch_stats.invalidated_inferences,
  missed: .current_epoch_stats.missed_requests
}'
```

**Pretty formatted output:**
```bash
curl -s "http://localhost/api/v1/inference/current" | python3 -c "
import sys, json
d = json.load(sys.stdin)
p = d.get('participants', [])
print('Inference Activity Summary:')
print('=' * 70)
for participant in p:
    stats = participant.get('current_epoch_stats', {})
    print(f\"\nParticipant: {participant['address'][:40]}...\")
    print(f\"  Inference Count: {stats.get('inference_count', 0)}\")
    print(f\"  Validated: {stats.get('validated_inferences', 0)}\")
    print(f\"  Invalidated: {stats.get('invalidated_inferences', 0)}\")
    print(f\"  Missed Requests: {stats.get('missed_requests', 0)}\")
    print(f\"  Earned Coins: {stats.get('earned_coins', 0)}\")
"
```

## Method 2: Check Specific Participant's Inference Activity

Get detailed inference information for a specific participant:

```bash
# Replace PARTICIPANT_ADDRESS with your node's address
PARTICIPANT_ADDRESS="gonka18s2h4n97txsyxntc0hk09zc9rtkq4dg8wn6d53"
EPOCH_ID=354  # Current epoch ID

# Get participant details
curl -s "http://localhost/api/v1/participants/${PARTICIPANT_ADDRESS}?epoch_id=${EPOCH_ID}" | jq '.participant.current_epoch_stats'
```

**Get detailed inference list:**
```bash
# Get all inferences (successful, expired, invalidated)
curl -s "http://localhost/api/v1/participants/${PARTICIPANT_ADDRESS}/inferences?epoch_id=${EPOCH_ID}" | jq
```

This returns:
- `successful`: List of successful inferences
- `expired`: List of expired inferences  
- `invalidated`: List of invalidated inferences

## Method 3: Check Historical Epoch Stats

Check inference activity for a specific historical epoch:

```bash
# Check epoch 353
curl -s "http://localhost/api/v1/inference/epochs/353" | jq '.participants[] | {
  address: .address,
  inference_count: .current_epoch_stats.inference_count,
  validated: .current_epoch_stats.validated_inferences
}'
```

## Method 4: Check PostgreSQL Metrics (If Using Grafana)

If you're collecting metrics in PostgreSQL:

```bash
# Check inference counts from metrics database
docker-compose exec postgres psql -U postgres -d gonka_tracker -c "
SELECT 
  node_address,
  MAX(inference_count) as max_inferences,
  MAX(validated_inferences) as max_validated,
  MAX(invalidated_inferences) as max_invalidated,
  COUNT(*) as data_points
FROM node_metrics
WHERE time > NOW() - INTERVAL '24 hours'
GROUP BY node_address
ORDER BY max_inferences DESC;
"
```

## Method 5: Check for Any Inference Activity (Quick Check)

Quick script to check if ANY node has had inference activity:

```bash
#!/bin/bash
echo "Checking for inference activity..."

RESPONSE=$(curl -s "http://localhost/api/v1/inference/current")
TOTAL_INFERENCES=$(echo "$RESPONSE" | jq '[.participants[].current_epoch_stats.inference_count] | add')

if [ "$TOTAL_INFERENCES" -gt 0 ]; then
    echo "✅ Inference activity detected! Total inferences: $TOTAL_INFERENCES"
    echo ""
    echo "Nodes with activity:"
    echo "$RESPONSE" | jq -r '.participants[] | select(.current_epoch_stats.inference_count > 0) | "  \(.address[:40])... - \(.current_epoch_stats.inference_count) inferences"'
else
    echo "❌ No inference activity detected"
    echo "All nodes show 0 inference count"
fi
```

## Method 6: Monitor Inference Activity Over Time

Check if inference counts are increasing:

```bash
# Check current counts
CURRENT=$(curl -s "http://localhost/api/v1/inference/current" | jq '[.participants[].current_epoch_stats.inference_count] | add')
echo "Current total inferences: $CURRENT"

# Wait and check again
sleep 60
NEW=$(curl -s "http://localhost/api/v1/inference/current" | jq '[.participants[].current_epoch_stats.inference_count] | add')
echo "New total inferences: $NEW"

if [ "$NEW" -gt "$CURRENT" ]; then
    echo "✅ Activity detected! Inferences increased by $((NEW - CURRENT))"
else
    echo "No new activity"
fi
```

## Method 7: Check Specific Node by Address

If you know your node's address:

```bash
# Set your node address
MY_NODE="gonka18s2h4n97txsyxntc0hk09zc9rtkq4dg8wn6d53"

# Get current epoch
EPOCH=$(curl -s "http://localhost/api/v1/inference/current" | jq -r '.epoch_id')

# Check your node's stats
curl -s "http://localhost/api/v1/participants/${MY_NODE}?epoch_id=${EPOCH}" | jq '{
  address: .participant.address,
  epoch: '${EPOCH}',
  stats: .participant.current_epoch_stats,
  node_healthy: .participant.node_healthy
}'
```

## Method 8: Check Detailed Inference List

Get the actual list of inferences (not just counts):

```bash
PARTICIPANT_ADDRESS="gonka18s2h4n97txsyxntc0hk09zc9rtkq4dg8wn6d53"
EPOCH_ID=354

# Get all inferences
curl -s "http://localhost/api/v1/participants/${PARTICIPANT_ADDRESS}/inferences?epoch_id=${EPOCH_ID}" | jq '{
  epoch_id: .epoch_id,
  participant_id: .participant_id,
  successful_count: (.successful | length),
  expired_count: (.expired | length),
  invalidated_count: (.invalidated | length),
  total: ((.successful | length) + (.expired | length) + (.invalidated | length))
}'
```

**Get first successful inference details:**
```bash
curl -s "http://localhost/api/v1/participants/${PARTICIPANT_ADDRESS}/inferences?epoch_id=${EPOCH_ID}" | jq '.successful[0]'
```

## Method 9: Check from Grafana Dashboard

If you have Grafana set up:

1. Open Grafana: `http://localhost/grafana`
2. Go to **Node Details** dashboard
3. Check the **Inference Count** panel
4. Look for any non-zero values

Or query directly:
```bash
docker-compose exec postgres psql -U postgres -d gonka_tracker -c "
SELECT 
  time,
  node_address,
  inference_count,
  validated_inferences,
  invalidated_inferences
FROM node_metrics
WHERE inference_count > 0
ORDER BY time DESC
LIMIT 20;
"
```

## Method 10: Complete Activity Report Script

Create a comprehensive report:

```bash
#!/bin/bash
# save as check_inference_activity.sh

API_URL="http://localhost/api/v1"
echo "=== Inference Activity Report ==="
echo "Generated: $(date)"
echo ""

# Get current epoch data
DATA=$(curl -s "${API_URL}/inference/current")
EPOCH=$(echo "$DATA" | jq -r '.epoch_id')
HEIGHT=$(echo "$DATA" | jq -r '.height')

echo "Current Epoch: $EPOCH"
echo "Block Height: $HEIGHT"
echo ""

# Summary
TOTAL_INFERENCES=$(echo "$DATA" | jq '[.participants[].current_epoch_stats.inference_count] | add')
TOTAL_VALIDATED=$(echo "$DATA" | jq '[.participants[].current_epoch_stats.validated_inferences] | add')
TOTAL_INVALIDATED=$(echo "$DATA" | jq '[.participants[].current_epoch_stats.invalidated_inferences] | add')

echo "=== Network Summary ==="
echo "Total Inferences: $TOTAL_INFERENCES"
echo "Total Validated: $TOTAL_VALIDATED"
echo "Total Invalidated: $TOTAL_INVALIDATED"
echo ""

# Per-node breakdown
echo "=== Per-Node Breakdown ==="
echo "$DATA" | jq -r '.participants[] | 
  "\(.address[:40])... | " +
  "Inferences: \(.current_epoch_stats.inference_count) | " +
  "Validated: \(.current_epoch_stats.validated_inferences) | " +
  "Invalidated: \(.current_epoch_stats.invalidated_inferences) | " +
  "Healthy: \(.node_healthy)"'

# Nodes with activity
echo ""
echo "=== Nodes with Activity ==="
ACTIVE_NODES=$(echo "$DATA" | jq '[.participants[] | select(.current_epoch_stats.inference_count > 0)]')
ACTIVE_COUNT=$(echo "$ACTIVE_NODES" | jq 'length')

if [ "$ACTIVE_COUNT" -gt 0 ]; then
    echo "$ACTIVE_NODES" | jq -r '.[] | "\(.address[:40])... - \(.current_epoch_stats.inference_count) inferences"'
else
    echo "No nodes with inference activity"
fi
```

Make it executable and run:
```bash
chmod +x check_inference_activity.sh
./check_inference_activity.sh
```

## Understanding the Results

### Key Metrics to Check:

1. **`inference_count`**: Total number of inference requests processed
   - If > 0: Node has processed inferences
   - If = 0: No inference activity

2. **`validated_inferences`**: Inferences that were validated by validators
   - Higher is better (means quality responses)

3. **`invalidated_inferences`**: Inferences that were rejected
   - Lower is better

4. **`missed_requests`**: Requests the node failed to process
   - Should be 0 for healthy nodes

### What to Look For:

- ✅ **Activity detected**: `inference_count > 0`
- ✅ **Good quality**: `validated_inferences` > `invalidated_inferences`
- ⚠️ **Issues**: High `missed_requests` or `invalidated_inferences`
- ❌ **No activity**: All counts are 0

## Quick One-Liner Checks

```bash
# Check if any node has activity
curl -s "http://localhost/api/v1/inference/current" | jq '[.participants[].current_epoch_stats.inference_count] | add'

# Count nodes with activity
curl -s "http://localhost/api/v1/inference/current" | jq '[.participants[] | select(.current_epoch_stats.inference_count > 0)] | length'

# Get node with most activity
curl -s "http://localhost/api/v1/inference/current" | jq '.participants | max_by(.current_epoch_stats.inference_count) | {address: .address, count: .current_epoch_stats.inference_count}'
```

## Troubleshooting

### All Counts Are Zero

If all inference counts are 0:
1. **Check if epoch is active**: Current epoch might not have started
2. **Check node health**: `node_healthy` should be `true`
3. **Check if requests are being sent**: Verify inference requests are actually being made
4. **Check epoch**: Make sure you're checking the correct epoch

### Counts Not Updating

If counts aren't updating:
1. **Check tracker sync**: Tracker might not be synced with chain
2. **Force reload**: Use `?reload=true` parameter
3. **Check cache**: Data might be cached

```bash
# Force reload
curl -s "http://localhost/api/v1/inference/current?reload=true" | jq '.participants[].current_epoch_stats.inference_count'
```

## Related Documentation

- **API Endpoints**: See `API_ENDPOINTS.md` for all available endpoints
- **Inference Requests**: See `INFERENCE_REQUESTS.md` for how to make inference requests
- **Grafana Dashboards**: See `GRAFANA_SETUP.md` for monitoring dashboards
