# Why Rewards Show as Zero

## Current Situation

The rewards panels in Grafana are showing zero because:

1. **Current Epoch Rewards**: The `earned_coins` and `rewarded_coins` fields in `current_epoch_stats` are cumulative values for the **current active epoch**. These are typically 0 until the epoch completes and rewards are settled.

2. **Data Source**: The metrics collector (`collect_metrics.py`) reads from `/api/v1/inference/current`, which shows current epoch stats. These stats show 0 for rewards because:
   - Rewards are calculated and distributed at epoch end
   - The current epoch (354) is still active
   - Historical epochs may also show 0 if they haven't been settled yet

3. **Rewards Storage**: Actual reward data is stored in:
   - SQLite: `participant_rewards` table (fetched from `get_epoch_performance_summary` API)
   - This data is only available for **completed epochs** that have been settled

## Solutions

### Option 1: Wait for Epoch Settlement
- Rewards will populate once epochs complete and rewards are calculated
- The dashboard will automatically show data once it's available

### Option 2: Query Historical Completed Epochs
If you want to see rewards from past epochs, you would need to:
1. Query the participant details API for completed epochs
2. Store that data in PostgreSQL
3. Update the Grafana queries

### Option 3: Use Participant Details API
The `/api/v1/participants/{participant_id}?epoch_id={epoch_id}` endpoint includes rewards for completed epochs. You could:
1. Create a script to fetch rewards for all participants across historical epochs
2. Store this in PostgreSQL
3. Query it in Grafana

## Current Data Status

- **Total records**: 189
- **Records with earned_coins > 0**: 0
- **Records with rewarded_coins > 0**: 0
- **Epochs tracked**: 353, 354 (both showing 0 rewards)

This indicates that either:
- The epochs haven't settled rewards yet
- The network is in a state where rewards haven't been distributed
- The data collection started before rewards were available

## To Verify Rewards Data

Check if rewards exist in the SQLite database:
```bash
docker-compose exec backend sqlite3 cache/cache.db "SELECT epoch_id, participant_id, rewarded_coins FROM participant_rewards LIMIT 10;"
```

Or check participant details for a completed epoch:
```bash
curl "http://localhost/api/v1/participants/gonka1abc123...?epoch_id=350"
```

## Next Steps

Once rewards are available (after epoch settlement), the Grafana panels will automatically display them. The queries are correct - they're just waiting for data to be populated.
