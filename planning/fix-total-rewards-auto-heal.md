# Fix: Auto-Healing Total Rewards Calculation

## Problem
When epoch 58 transitioned to 59, the total rewards calculation ran but the chain API hadn't finalized rewards yet, returning 0 for all participants. This 0 GNK value was cached, and even though individual participants now show rewards, the cached total remained at 0.

## Solution: Self-Healing System
Modified the backend to automatically detect and fix invalid cached values (0 GNK) without requiring manual intervention or scripts.

## Changes Made

### 1. Auto-Detection on Data Access (service.py:213-224)
When accessing historical epoch data, the system now:
- Detects if cached total is 0 (invalid)
- Automatically deletes the bad cache
- Recalculates the correct value

```python
total_rewards_gnk = await self.cache_db.get_epoch_total_rewards(epoch_id)
if total_rewards_gnk is None or total_rewards_gnk == 0:
    if total_rewards_gnk == 0:
        logger.warning(f"Detected invalid cached total rewards (0 GNK) for epoch {epoch_id}, deleting and recalculating")
        await self.cache_db.delete_epoch_total_rewards(epoch_id)
    
    # Recalculate...
```

### 2. Auto-Fix in Background Polling (service.py:845-855)
Background polling now detects and fixes 0 GNK values:
- Checks if cached value is 0
- Deletes bad cache and recalculates
- Runs every 10 minutes for last 5 epochs

### 3. Prevent Caching Bad Data (service.py:813-815)
Skip caching when all participants have 0 rewards:
```python
if total_ugnk == 0 and fetched_count > 0:
    logger.warning(f"Epoch {epoch_id} rewards calculation returned 0 for all {fetched_count} participants - rewards may not be available yet, skipping cache")
    return
```

### 4. Frontend Shows "-" for 0 Values (App.tsx:296-304)
Frontend now treats 0 as unknown and displays "-" with "Calculating..." message instead of "0 GNK".

### 5. Database Method Added (database.py:659-669)
Added `delete_epoch_total_rewards()` method for clearing bad cached values.

## How It Works

### Automatic Fix on Access
1. User views epoch 58 (or any epoch with cached 0 GNK)
2. Backend detects the invalid 0 value
3. Deletes bad cache and recalculates with current API data
4. Returns correct total rewards

### Automatic Fix on Background Poll
1. Every 10 minutes, polls last 5 epochs
2. Detects any epochs with cached 0 GNK
3. Automatically recalculates them

### Prevention for Future Epochs
1. On epoch transition, calculates rewards synchronously
2. If API returns all 0s (rewards not ready), skips caching
3. Will retry on next access or background poll

## Deployment

Just redeploy the app:
```bash
make run-app
```

The system will automatically:
- Fix epoch 58 when it's accessed (immediate)
- Fix it in background polling within 10 minutes
- Prevent this issue for future epochs

## Testing
All 98 backend tests pass, including:
- Epoch total rewards tests
- Database operations
- Service logic
- API endpoints

