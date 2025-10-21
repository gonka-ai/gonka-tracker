# Task 15: Time To Next Epoch Timer

## Overview
Add an interactive countdown timer to the dashboard showing time remaining until the next epoch starts, with special handling for PoC phase detection.

## Implementation

### Backend Changes

#### 1. Extended InferenceResponse Model
Added new optional fields to `backend/src/backend/models.py`:
- `current_block_height: Optional[int]`
- `current_block_timestamp: Optional[str]`
- `avg_block_time: Optional[float]`
- `next_poc_start_block: Optional[int]`
- `set_new_validators_block: Optional[int]`

#### 2. Added Block Time Calculation Helper
Created `_calculate_avg_block_time()` method in `backend/src/backend/service.py`:
- Samples 10,000 blocks (current and reference)
- Calculates time difference in seconds
- Returns average block time rounded to 2 decimals
- Falls back to 6.0 seconds on error

#### 3. Updated Service Layer
Modified `get_current_epoch_stats()` in `backend/src/backend/service.py`:
- Fetches latest epoch info from `/v1/epochs/latest`
- Matches current epoch ID to determine correct stage data:
  - If viewing current epoch: uses `epoch_stages.next_poc_start` and `next_epoch_stages.set_new_validators`
  - If viewing next epoch (edge case): uses `next_epoch_stages.next_poc_start`
  - Otherwise: sets fields to None
- Calculates avg_block_time for current epoch
- Fetches current block data for timestamp
- Populates all timing fields in single response

Historical epochs return None for all timing fields (timer not applicable).

### Frontend Changes

#### 4. Updated TypeScript Types
Extended `InferenceResponse` interface in `frontend/src/types/inference.ts` with:
- `current_block_height?: number`
- `current_block_timestamp?: string`
- `avg_block_time?: number`
- `next_poc_start_block?: number`
- `set_new_validators_block?: number`

#### 5. Created EpochTimer Component
Created `frontend/src/components/EpochTimer.tsx`:
- Returns null if timing data not available (historical epochs)
- Maintains client-side countdown that updates every second
- Estimates current block height based on elapsed time and avg_block_time
- Detects PoC phase: shows "PoC in Progress" with animated pulse when current block is between next_poc_start and set_new_validators
- Otherwise shows countdown timer with human-readable format
- Formats time as "Xd Xh Xm" or "Xh Xm Xs" or "Xm Xs"
- Shows blocks remaining as secondary information
- Uses blue color for countdown, orange for PoC in progress

#### 6. Integrated into Dashboard
Modified `frontend/src/App.tsx`:
- Imported EpochTimer component
- Added to epoch stats grid (changed from 5 to 6 columns on large screens)
- Positioned after Total Assigned Rewards
- Automatically updates when parent data refreshes (every 30s for current epoch)

## Technical Details

### Epoch Matching Logic
Critical logic to ensure correct stage data is used:
```python
if current_epoch_id == latest_epoch_index:
    # Current epoch: use epoch_stages + next_epoch_stages
    next_poc_start = epoch_stages["next_poc_start"]
    set_new_validators = next_epoch_stages["set_new_validators"]
elif current_epoch_id == next_epoch_stages["epoch_index"]:
    # Edge case: already in next epoch
    next_poc_start = next_epoch_stages["next_poc_start"]
    set_new_validators = None
```

### Client-Side Countdown
- Server provides: current_block_height, current_block_timestamp, avg_block_time
- Client calculates: elapsed_seconds = (Date.now() - server_timestamp) / 1000
- Estimates: estimated_blocks_passed = elapsed_seconds / avg_block_time
- Updates: estimated_current_block = current_block_height + estimated_blocks_passed
- Refreshes: when parent component fetches new data (every 30s)

### PoC Detection
Shows "PoC in Progress" when:
```
estimated_current_block >= next_poc_start_block AND
estimated_current_block < set_new_validators_block
```

### Efficiency
No additional API calls from frontend - all timing data comes in single InferenceResponse payload.

## Testing
All 98 backend tests pass, including existing tests that verify InferenceResponse structure.

## Result
Dashboard now displays an interactive timer showing:
- Countdown to next epoch with blocks remaining (normal state)
- "PoC in Progress" indicator with animated pulse (during PoC phase)
- Timer only appears for current epoch (hidden for historical epochs)
- Updates every second on client-side
- Syncs with server data every 30s

