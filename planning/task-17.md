# Task 17: Participant Inference Details

## Task
Add an "Inferences" tab to Participant Details modal showing top-10 successful, expired, and invalidated inferences for the current epoch with full detail view.

## Status
IMPLEMENTED + EXTENDED

## Result
Participant modal now includes:
- Tab navigation: "Details" | "Inferences"
- Modal title: "Participant" (minimalistic, no redundancy)
- Details tab is default view
- Inferences tab displays three categorized tables (successful, expired, invalidated)
- **Inferences available for current and previous epoch (current-1)** - older epochs show "Data not available for older epochs"
- Clickable rows open nested modal with full inference details
- Copy-to-clipboard functionality for all fields
- Background polling updates cache every 10 minutes
- Data only from cache DB for optimal performance
- **Fixed**: Red participant highlighting for high missed_rate/invalidation_rate now works correctly

## Implementation

### Backend

**Database:**
- Added `participant_inferences` table with fields: inference_id, status, block_height, timestamp, validated_by, hashes, payloads, tokens, model
- Index on (epoch_id, participant_id, status) for efficient queries
- Methods: `save_participant_inferences_batch()`, `get_participant_inferences()`

**Client:**
- Added `get_all_inferences()` method to fetch from `/chain-api/productscience/inference/inference/inference`
- Properly handles pagination (fetches all pages with next_key)
- Filters by epoch if provided, **including inferences with epoch_id='0'** (to be fixed in service layer)
- Returns all inferences for efficient batch processing

**Models:**
- `InferenceDetail`: Full inference data model with optional fields
- `ParticipantInferencesResponse`: Categorized response (successful, expired, invalidated)

**Service:**
- `poll_participant_inferences()`: Background task runs every 10 minutes
  - First poll happens immediately at startup
  - Fetches ALL inferences for current epoch ONCE (with pagination)
  - **Fixes epoch_id='0' issue**: Calculates correct epoch_id from start_block_height using epoch_length
    - Formula (ceiling division): `epochs_back = (blocks_before_current + epoch_length - 1) // epoch_length`
    - Then: `epoch_id = current_epoch - epochs_back`
    - This handles EXPIRED inferences that have epoch_id='0' in the chain data
    - Uses ceiling division to correctly handle partial epochs (any blocks before current epoch = at least 1 epoch back)
  - Logs epoch distribution before filtering to verify calculations
  - Filters to keep only inferences matching current epoch after fixing (global filter)
  - Groups inferences by participant in memory
  - Double-checks epoch_id per participant (logs warnings if wrong epochs found)
  - Filters status: FINISHED, VALIDATED, EXPIRED, INVALIDATED
  - Categorizes: FINISHED/VALIDATED as "successful"
  - Stores top-10 per category per participant (sorted by timestamp descending)
  - Efficient: 1 API call instead of N calls (where N = number of participants)
  - Detailed logging: epoch fixing, status distribution, per-participant breakdown, pagination stats
- `get_participant_inferences_summary()`: Cache-only mode (no lazy loading)
  - Returns cached data if available
  - Returns empty if no cache (waits for next polling cycle)
  - Prevents race conditions when multiple participants load simultaneously
- Efficient storage: Only top-10 per status to minimize DB size

**Router:**
- New endpoint: `GET /participants/{participant_id}/inferences?epoch_id={epoch_id}`
- Returns ParticipantInferencesResponse
- Proper error handling and validation

**Background Polling:**
- Added `POLL_PARTICIPANT_INFERENCES_INTERVAL` config (default: 600s)
- Task starts immediately at launch (no delay)
- Ensures data available quickly after startup
- Lifecycle managed in app lifespan context

### Frontend

**Types:**
- `InferenceDetail` interface with all inference fields
- `ParticipantInferencesResponse` interface with categorized arrays

**InferenceDetailModal Component (NEW):**
- Nested modal (z-index 60, above participant modal)
- Displays inference fields with formatted labels
- Copy buttons for: inference_id, prompt_hash, response_hash
- Visual feedback on copy (button text changes to "Copied!")
- Formatted timestamp: milliseconds to readable date
- Status badges with color coding (green/yellow/red)
- Validated_by list with individual entries
- Escape key and backdrop click to close
- Note: Prompt and response payloads are hidden for privacy/security

**ParticipantTable Updates:**
- Added `isCurrentEpoch` prop to interface
- Receives `data.is_current` from App.tsx
- Forwards `isCurrentEpoch` to ParticipantModal

**ParticipantModal Updates:**
- Modal title changed to "Participant" for minimalistic design
- Added tab state management (details | inferences)
- Tab labels: "Details" and "Inferences"
- Details tab is default (activeTab initialized to 'details')
- Tab state resets to 'details' when participant changes (prevents staying on Inferences tab)
- **Current epoch restriction**: Inferences only shown for current epoch
  - Receives `isCurrentEpoch` prop from ParticipantTable
  - Displays "Data not available for finished epochs" for historical epochs
  - No API calls made for historical epochs
- Sticky tab navigation bar
- Separate useEffect for fetching inferences (non-blocking, only if current epoch)
- Three tables in Inferences tab:
  - Successful (top 10) - green theme
  - Expired (top 10) - yellow theme
  - Invalidated (top 10) - red theme
- Table columns: Inference ID (clickable), Block Height, Validated By (count)
- Row hover effect and cursor pointer
- Loading and error states
- Cache timestamp display at bottom
- Empty states with helpful messages

## Technical Details

### Status Categorization
- **Successful**: FINISHED or VALIDATED status
- **Expired**: EXPIRED status
- **Invalidated**: INVALIDATED status

### Epoch ID Fix for EXPIRED Inferences
- **Problem**: Chain returns `epoch_id='0'` for EXPIRED inferences
- **Solution**: Calculate correct epoch from `start_block_height` using ceiling division
- **Algorithm**:
  1. Get current epoch's `effective_block_height` and `epoch_length`
  2. For each inference with `epoch_id='0'`:
     - If `start_block_height >= current_epoch_effective_height`: belongs to current epoch
     - Otherwise:
       - `blocks_before_current = current_epoch_effective_height - start_block_height`
       - `epochs_back = (blocks_before_current + epoch_length - 1) // epoch_length` (ceiling division)
       - `epoch_id = current_epoch - epochs_back`
  3. Re-filter all inferences to keep only those matching current epoch
- **Why ceiling division**: Any inference that started before the current epoch's effective height must be from a previous epoch. Floor division incorrectly assigns inferences to current epoch when `blocks_before_current < epoch_length`.
- **Impact**: EXPIRED inferences now correctly appear in the dashboard for their actual epoch

### Storage Strategy
- Only stores top-10 per category per participant per epoch
- Reduces DB size while maintaining useful data
- Prompt and response payloads are stored but not displayed in UI

### Data Flow
1. Background task starts immediately at launch
2. Fetches current epoch participants list and epoch parameters (length, effective_height)
3. Fetches ALL inferences for epoch ONCE with full pagination (includes epoch_id='0')
4. **Fixes epoch_id='0' by calculating from block height**
5. Re-filters to keep only current epoch inferences
6. Groups inferences by participant in memory
7. For each participant: filters and categorizes by status
8. Sorts by timestamp (newest first)
9. Takes top-10 per category
10. Saves to cache DB (replaces old data)
11. Repeats every 10 minutes
12. Frontend fetches on participant modal open
13. If no cache: returns empty, waits for next polling cycle
14. Separate async request doesn't block main details
15. Click on row opens nested modal with full data

### Copy Functionality
```typescript
const copyToClipboard = (text: string, fieldName: string) => {
  navigator.clipboard.writeText(text).then(() => {
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  })
}
```

### Timestamp Formatting
```typescript
const formatTimestamp = (timestamp: string) => {
  const ts = parseInt(timestamp) / 1000
  return new Date(ts * 1000).toLocaleString()
}
```

## Performance Optimizations

### Efficient Batch Fetching
- Fetches ALL inferences once per polling cycle (not per participant)
- Handles pagination properly (fetches all pages)
- Groups by participant in memory
- Result: 1 API call instead of N calls (where N = number of participants)
- Massive reduction in API load: 50 participants = 98% fewer API calls

### Cache-First Strategy
- All data served from cache DB
- No live API calls during modal interaction
- Fast response times

### Storage Efficiency
- Only top-10 per status category stored
- Prevents unbounded DB growth
- Adequate for debugging and monitoring

### Non-Blocking Load
- Inferences fetch in separate useEffect
- Main participant details load independently
- User can view details while inferences load

### Cache-Only Strategy
- No lazy loading or inline fetches
- Returns empty if cache not available
- Prevents race conditions when many participants load simultaneously
- Waits for next polling cycle (max 10 minutes) for data
- Avoids expensive duplicate API calls on page load

## Key Design Decisions

1. **Efficient Batch Fetching** - Fetch all inferences once per cycle, not per participant (1 API call vs N calls)
2. **Proper Pagination** - Handle all pages with next_key to ensure complete data
3. **Memory Grouping** - Group by participant in memory after single fetch
4. **Cache-Only Mode** - No lazy loading/inline fetches to prevent race conditions
5. **Immediate First Poll** - Start immediately at launch, not after 10 minute delay
6. **Minimalistic Modal Title** - "Participant" instead of "Participant Details" to avoid redundancy with tab name
7. **Tab Navigation** - Clean separation: "Details" and "Inferences" tabs
8. **Details Default** - Details tab is default view, inferences are secondary information
9. **Top-10 Limit** - Balance between usefulness and storage
10. **Current Epoch Only** - Historical inferences not needed for current use case
11. **Hidden Payloads** - Prompt and response payloads not displayed for privacy/security
12. **Copy Buttons** - Essential for debugging (IDs and hashes only, not payloads)
13. **Nested Modal** - Better UX than replacing modal content
14. **10-Minute Polling** - Matches other background tasks, sufficient freshness
15. **Status Colors** - Visual distinction (green=good, yellow=warning, red=error)
16. **Separate Request** - Lower priority, doesn't block main functionality

## Files Modified

**Backend:**
- `backend/src/backend/database.py` - Added table and methods
- `backend/src/backend/client.py` - Added get_participant_inferences()
- `backend/src/backend/models.py` - Added InferenceDetail and ParticipantInferencesResponse
- `backend/src/backend/service.py` - Added polling and retrieval methods
- `backend/src/backend/router.py` - Added inferences endpoint
- `backend/src/backend/app.py` - Added polling task and config

**Frontend:**
- `frontend/src/types/inference.ts` - Added inference types
- `frontend/src/components/InferenceDetailModal.tsx` - New nested modal
- `frontend/src/components/ParticipantModal.tsx` - Added tabs and inferences view

**Configuration:**
- `config.env.template` - Added POLL_PARTICIPANT_INFERENCES_INTERVAL

**Cleanup:**
- Removed temporary files: `inferences.py`, `debug-missed.ipynb`

## Testing

Manual testing:
1. Start backend - first inference poll happens immediately
2. Open participant modal for any active participant
3. Verify modal title is "Participant" (not "Participant Details")
4. Verify "Details" tab is active by default (blue underline)
5. Click "Inferences" tab
6. If data not yet loaded (very quick startup): verify "No inferences" message, wait a moment
7. Verify three sections appear: Successful, Expired, Invalidated
8. Verify loading state shows briefly
9. Check that data displays in tables
10. Click on any inference row
11. Verify nested modal opens with full details
12. Test copy buttons for inference_id, prompt_hash, response_hash
13. Verify "Copied!" feedback appears
14. Verify timestamp is formatted as readable date
15. Verify payloads are NOT displayed (hidden for privacy)
16. Press Escape or click backdrop to close detail modal
17. Verify cache timestamp appears at bottom
18. Wait 10 minutes, refresh, verify data updates

API testing:
```bash
# Test endpoint directly
curl "http://localhost:8000/api/v1/participants/gonka14cu38xpsd8pz5zdkkzwf0jwtpc0vv309ake364/inferences?epoch_id=64" | jq

# Expected response structure:
# {
#   "epoch_id": 64,
#   "participant_id": "gonka14cu38x...",
#   "successful": [...],
#   "expired": [...],
#   "invalidated": [...],
#   "cached_at": "2024-10-27T12:34:56.789"
# }
```

Database testing:
```bash
# Check table was created
sqlite3 backend/cache.db ".schema participant_inferences"

# Check data after polling
sqlite3 backend/cache.db "SELECT COUNT(*) FROM participant_inferences;"
sqlite3 backend/cache.db "SELECT status, COUNT(*) FROM participant_inferences GROUP BY status;"
```

## Extensions (Post-Implementation)

### Extension 1: Support for Current-1 Epoch

**Changes:**

Backend (`service.py`):
- Modified `poll_participant_inferences()` to fetch ALL inferences without epoch filter (line 1219)
- Filter for both current and current-1 epochs using `target_epochs` set (line 1246)
- Group inferences by both participant AND epoch (line 1269-1281)
- Save inferences separately for each epoch (line 1286-1318)
- Single API call handles both epochs efficiently

Frontend:
- Added `currentEpochId` prop flow: App.tsx → ParticipantTable → ParticipantModal
- Changed epoch availability check from `!isCurrentEpoch` to `epochId < currentEpochId - 1` (line 69, 492)
- Updated message: "Data only available for current and previous epoch" (line 495)

### Extension 2: Fix Red Participant Highlighting

**Issue:** Computed fields `missed_rate` and `invalidation_rate` were not being serialized in API responses, breaking red row highlighting for participants with high error rates.

**Fix:** Added `ConfigDict` to `ParticipantStats` model in `models.py`:
```python
from pydantic import BaseModel, Field, computed_field, ConfigDict

class ParticipantStats(BaseModel):
    model_config = ConfigDict(from_attributes=True)
```

This ensures `@computed_field` properties are included in JSON serialization.

### Extension 3: Fix UI Blink + Auto-Refresh on Inferences Tab

**Issue 1:** When viewing the Inferences tab, users experienced a UI blink/flash even when data was already loaded and unchanged.

**Root Cause:** The inferences `useEffect` had `details` in its dependency array. Every time the details were refetched, it would trigger the inferences fetch again, causing `setInferencesLoading(true)` and a brief loading state flash.

**Issue 2:** Inferences data changes every 10 minutes (backend polling), but the modal wasn't refreshing to show updated data.

**Solution in ParticipantModal.tsx:**

1. **Debounced Fetch Logic** (lines 62-95):
   - Added `lastInferencesFetch` timestamp state to track last fetch time
   - Added 5-second debounce: prevents refetch if less than 5 seconds since last fetch
   - Eliminates unnecessary rapid refetches while allowing periodic updates
   - Updates timestamp after successful fetch

2. **Auto-Refresh When On Inferences Tab** (lines 97-111):
   - Added interval timer that runs while `activeTab === 'inferences'`
   - Resets `lastInferencesFetch` to 0 every 30 seconds
   - Triggers the main fetch useEffect to reload data
   - Cleans up interval when tab changes or modal closes
   - Backend polls every 10 minutes, frontend checks every 30 seconds for updates

3. **State Clearing** (line 42):
   - `setInferences(null)` when participant/epoch changes to clear stale data

**Result:**
- No more UI blinks from unnecessary rapid fetches (5-second debounce)
- Data auto-refreshes every 30 seconds when viewing Inferences tab
- Catches backend updates within 30 seconds of polling
- Interval stops when not on Inferences tab (efficient)
- Clean modal state when switching participants

### Extension 4: Better Error Handling for Inference Loading

**Issue:** Sometimes users saw "Failed to load inferences" message, but it wasn't clear if it was a real error or if the cache wasn't ready yet.

**Root Cause:** The UI didn't differentiate between:
- Network/API errors (real failures)
- Empty cache (backend hasn't polled yet)
- No data state

**Solution in ParticipantModal.tsx:**

1. **Added Error State** (line 21):
   - New `inferencesError` state to track actual fetch errors
   - Separated error tracking from data state

2. **Enhanced Error Handling** (lines 80, 90, 96-98):
   - Clear error state before fetch
   - Set error message on catch
   - Still update lastInferencesFetch timestamp to prevent retry loops

3. **Improved UI States** (lines 526-537):
   - **Loading**: "Loading inferences..."
   - **Error**: "Failed to load inferences" with error details (red text)
   - **Empty response**: "No data available"
   - **Cache not ready**: "Inference data not yet available" with helpful message
   - **Success with data**: Show inference tables

4. **State Reset** (line 45):
   - Clear error state when switching participants/epochs

**Result:**
- Clear distinction between temporary states and actual errors
- Helpful message when cache not ready yet (first 10 minutes after backend start)
- Error details shown to help diagnose issues
- Better UX with appropriate guidance for each state

### Extension 5: Fix Modal Click Propagation

**Issue:** When viewing inference details in the nested InferenceDetailModal, clicking outside the modal to close it would also close the ParticipantModal, returning the user to the dashboard instead of the participant's Inferences tab.

**Root Cause:** The InferenceDetailModal backdrop click handler called `onClose()` but didn't stop event propagation. The click event bubbled up to the ParticipantModal's backdrop handler (which is underneath at z-50), causing it to close as well.

**Solution in InferenceDetailModal.tsx (lines 44-47):**

Changed from:
```typescript
onClick={onClose}
```

To:
```typescript
onClick={(e) => {
  e.stopPropagation()
  onClose()
}}
```

**Result:**
- Clicking outside InferenceDetailModal now only closes the detail modal
- Returns user to the participant's Inferences tab as expected
- ParticipantModal remains open and functional
- Proper modal nesting behavior

### Extension 6: Fix Intermittent Inference Loading Failures

**Issue:** Users experienced intermittent "Failed to load inferences" errors even when cache exists. Same participant would sometimes load successfully, sometimes fail.

**Root Causes:**
1. **JSON parsing failures**: `validated_by_json` field could contain invalid JSON, causing entire database query to fail
2. **Missing validation**: No per-record error handling, one bad record breaks everything
3. **Silent failures**: Pydantic validation errors when converting dicts to InferenceDetail objects

**Solutions:**

**1. Database Layer** (`database.py` lines 815-841):
- Added per-record try-catch to handle individual record failures
- Separate try-catch specifically for JSON parsing of `validated_by_json`
- Log warnings for invalid records but continue processing others
- Return None only if no valid records exist (not if some fail)

```python
for row in rows:
    try:
        validated_by = []
        if row["validated_by_json"]:
            try:
                validated_by = json.loads(row["validated_by_json"])
            except json.JSONDecodeError as e:
                logger.warning(f"Invalid JSON in validated_by for inference {row['inference_id']}: {e}")
        # ... continue processing
    except Exception as e:
        logger.warning(f"Failed to parse inference record: {e}")
        continue
```

**2. Service Layer** (`service.py` lines 1356-1375):
- Added validation to skip records missing required fields (inference_id, status)
- Per-record try-catch to handle processing errors
- Track and log count of skipped invalid records
- Enhanced error logging with `exc_info=True` for debugging

```python
for inf in cached_inferences:
    try:
        if not inf.get("inference_id") or not inf.get("status"):
            skipped_count += 1
            continue
        # ... process valid record
    except Exception as e:
        logger.warning(f"Skipping invalid inference record: {e}")
        skipped_count += 1
        continue
```

**Result:**
- Robust error handling at both database and service layers
- One corrupted record no longer breaks entire response
- Detailed logging helps identify and fix data quality issues
- Users see available valid inferences even if some records are corrupted
- Consistent behavior instead of intermittent failures

### Extension 7: Fix Frontend Race Condition (Alternating Data/No Data)

**Issue:** Users experienced alternating "data" / "no data" when repeatedly clicking the same participant, even though backend cache was stable with no errors.

**Root Cause:** The debounce mechanism was **participant-agnostic**:
1. Click participant A → fetch → show data ✓
2. Click participant B → clear state (`setInferences(null)`) → fetch for B
3. Click participant A again quickly (< 5 seconds) → **debounce blocks fetch** → state is `null` → shows "No data" ✗
4. The debounce tracked a global timestamp, not per-participant
5. State was cleared when switching participants, but debounce prevented refetch

**Solution in ParticipantModal.tsx:**

Changed debounce state from simple timestamp to **participant-specific key**:

```typescript
// Before (line 23):
const [lastInferencesFetch, setLastInferencesFetch] = useState<number>(0)

// After:
const [lastInferencesFetch, setLastInferencesFetch] = useState<{timestamp: number, key: string}>({timestamp: 0, key: ''})
```

Updated debounce logic (lines 73-78):
```typescript
const fetchKey = `${participant.index}-${epochId}`
const timeSinceLastFetch = now - lastInferencesFetch.timestamp

// Only debounce if SAME participant+epoch AND within 5 seconds
if (lastInferencesFetch.key === fetchKey && lastInferencesFetch.timestamp > 0 && timeSinceLastFetch < 5000) {
  return
}
```

Updated auto-refresh interval (lines 113-115):
```typescript
const fetchKey = `${participant.index}-${epochId}`
const interval = setInterval(() => {
  setLastInferencesFetch({timestamp: 0, key: fetchKey})
}, 30000)
```

**Result:**
- Debounce now tracks per participant+epoch combination
- Switching participants resets debounce for that specific participant
- Clicking same participant repeatedly always shows consistent data
- No more alternating data/no data behavior
- Auto-refresh still works correctly for active participant

### Extension 8: Fix Persisting Inference Detail Modal

**Issue:** When viewing an inference detail modal, then closing to dashboard and opening a different participant, the old inference detail modal would appear instead of the new participant's details tab.

**Root Cause:** The `selectedInference` state was not being cleared when switching participants. State cleanup was incomplete:
- ✓ `setActiveTab('details')` - tab reset
- ✓ `setInferences(null)` - inferences cleared
- ✓ `setInferencesError(null)` - errors cleared
- ✗ `selectedInference` - NOT cleared

**Solution in ParticipantModal.tsx (line 46):**

Added to participant change useEffect:
```typescript
setSelectedInference(null)  // Clear any open inference detail modal
```

**Result:**
- Opening a new participant always starts clean with details tab
- No ghost inference detail modals from previous participant
- Complete state reset when switching participants
- Proper modal state lifecycle

### Extension 9: Smart Background Refresh (No Loading State)

**Issue:** When auto-refresh triggered every 30 seconds, the UI would show "Inference data not yet available" loading state even though we already had data displayed.

**Solution in ParticipantModal.tsx (lines 82-85):**

Only show loading state when needed:
```typescript
if (!inferences || inferences.epoch_id !== epochId || inferences.participant_id !== participant.index) {
  setInferencesLoading(true)
}
```

**Result:**
- Initial load shows loading state
- Auto-refresh updates silently without blocking UI
- Users can continue viewing existing data while refresh happens

### Extension 10: Fix Missing Cache Entries for Participants with No/Filtered Inferences

**Issue:** About half of participants showed "Inference data not yet available" even after backend polling completed. This happened for participants who:
- Had zero inferences
- Had only inferences that were filtered out (wrong epoch)
- Had all inferences of one type (e.g., only EXPIRED)

**Root Causes:**
1. **Line 1256**: Only participants WITH inferences were added to `by_participant`
2. **Line 1286**: Only epochs that had inferences were saved
3. If participant had no valid inferences after filtering, no cache entry was created
4. Frontend received `cached_at: None` and showed "data not yet available"

**Solutions in service.py:**

**1. Initialize ALL participants** (line 1256):
```python
# Before:
by_participant = {}
for inf in all_inferences:
    if assigned_to not in by_participant:
        by_participant[assigned_to] = []

# After:
by_participant = {p["index"]: [] for p in participants}
```
Now every participant gets an entry, even with zero inferences.

**2. Save cache for ALL target epochs** (lines 1285-1287):
```python
# Before:
for epoch_id, epoch_inferences in by_epoch.items():  # Only epochs with data

# After:  
for epoch_str in target_epochs:  # Both current and current-1
    epoch_id = int(epoch_str)
    epoch_inferences = by_epoch.get(epoch_str, [])  # Empty list if no data
```

**3. Always save, even if empty** (line 1312):
```python
await self.cache_db.save_participant_inferences_batch(
    epoch_id=int(epoch_id),
    participant_id=participant_id,
    inferences=to_save  # Can be empty list
)
```

**Result:**
- Every participant gets cache entries for both current and current-1 epochs
- Empty arrays saved for participants with no inferences (normal state)
- Frontend receives `cached_at` timestamp even for empty data
- No more "data not yet available" for participants with zero/filtered inferences
- Proper distinction between "no cache" (backend not polled) and "no inferences" (polled but empty)

## Notes

- Inferences stored and displayed for current and previous epoch
- Older historical epochs not included
- Both FINISHED and VALIDATED count as successful (same meaning)
- Nested modal has higher z-index (60) than participant modal (50)
- Copy functionality requires HTTPS or localhost for clipboard API
- Prompt and response payloads are intentionally hidden (not displayed or stored in cache)
- Empty states guide user when no inferences exist
- Loading states prevent confusion during async fetch
- Tab navigation provides clean organization
- Separate request ensures main details always load quickly
- Background polling ensures data freshness without user action
- Cache-only approach prevents race conditions
- First poll happens immediately at startup for quick data availability
- If cache not available, returns empty (no lazy loading)
- Top-10 limit balances usefulness with storage efficiency
- Status categorization helps identify issues quickly
- Copy buttons for IDs and hashes essential for debugging (payloads hidden for privacy)
- Timestamp formatting makes data human-readable
- Validated_by count shows consensus at a glance
- Full detail modal provides complete investigation capability
- Minimalistic naming avoids redundancy (modal title "Participant", tab "Details" instead of repeating "Participant Details")
- Efficient batch fetching: Single API call with full pagination instead of N calls per participant
- Proper pagination handling ensures all inferences are captured, not just first page
- Memory grouping strategy reduces API load by 98% for typical 50-participant epoch
- Cache-only strategy avoids expensive duplicate API calls when many participants load at once
- Tab state resets when switching participants (always starts on Details tab)
- Comprehensive logging: status distribution, pagination stats, per-participant breakdown for debugging
- Logging helps diagnose if EXPIRED/INVALIDATED inferences are missing

