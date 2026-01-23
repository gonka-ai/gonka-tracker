# Rewards Data Fix

## Problem
Rewards were showing as zero because:
- The metrics collector was only reading from `/api/v1/inference/current`
- That endpoint's `current_epoch_stats` shows 0 for rewards (they're only populated after epoch settlement)
- Historical rewards are available via `/api/v1/participants/{address}?epoch_id={epoch_id}` endpoint

## Solution

### 1. Added `participant_rewards` Table
Created a new PostgreSQL table to store historical rewards per epoch:
- `time`: Timestamp when the reward was collected
- `node_address`: Participant address
- `epoch_id`: Epoch ID
- `assigned_reward_gnk`: Reward amount in base units (stored as BIGINT)
- `claimed`: Whether the reward has been claimed

### 2. Updated Metrics Collector
Modified `scripts/collect_metrics.py` to:
- Fetch participant details for each participant
- Extract the `rewards` array from the response
- Store each reward in the `participant_rewards` table
- Convert GNK to base units (1 GNK = 1,000,000,000 base units) for consistency

### 3. Updated Grafana Dashboard
Updated `grafana/dashboards/gonka-rewards-panel.json` queries to:
- Use `participant_rewards` table instead of `node_metrics`
- Convert base units back to GNK for display (divide by 1,000,000,000)
- Show assigned rewards and claimed status

## Changes Made

1. **Database Schema** (`grafana/init_db.sql`):
   - Added `participant_rewards` table with TimescaleDB hypertable
   - Added indexes for efficient querying

2. **Metrics Collector** (`scripts/collect_metrics.py`):
   - Added `get_participant_details()` function
   - Added `write_participant_rewards()` function
   - Integrated rewards collection into main loop

3. **Grafana Dashboard** (`grafana/dashboards/gonka-rewards-panel.json`):
   - Updated "Earned Coins" panel to use `participant_rewards`
   - Updated "Rewarded Coins" panel to show claimed rewards
   - Updated "Reward Rate" panel to show claim rate
   - Updated summary table to show totals per participant

## Next Steps

1. **Run the database migration** (already done):
   ```bash
   docker-compose exec -T postgres psql -U postgres -d gonka_tracker < grafana/init_db.sql
   ```

2. **Restart the metrics collector** to start fetching rewards:
   ```bash
   # If running in a separate process, restart it
   # The collector will now fetch rewards for all participants
   ```

3. **Wait for data collection**: The collector will fetch rewards on the next collection cycle (every 30 seconds by default)

4. **View in Grafana**: The rewards dashboard should now show historical rewards data

## Data Format

- **API Response**: `assigned_reward_gnk` is in GNK units (e.g., 80512 = 80512 GNK)
- **Database Storage**: Stored in base units (80512 GNK = 80512000000000 base units)
- **Grafana Display**: Converted back to GNK for readability

## Notes

- The collector fetches rewards for all participants on each cycle
- Rewards are stored per epoch, so you'll see one record per participant per epoch
- The `claimed` field indicates if the reward has been claimed
- Historical rewards from past epochs will be populated as the collector runs
