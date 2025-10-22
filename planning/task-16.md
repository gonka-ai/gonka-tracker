# Task 16: Detailed Future Timeline View

## Task
Add a detailed timeline visualization showing the next epoch_length blocks from current position with vertical ticks every 100 blocks and horizontal lines for upcoming epoch stage events.

## Status
IMPLEMENTED

## Result
Timeline page now displays a detailed view below the 2-month timeline showing:
- One full epoch into the future (current_block_height to current_block_height + epoch_length)
- Vertical ticks for blocks where % 100 == 0 (subtle, gray)
- Horizontal lines for future epoch events: inference_validation_cutoff, next_poc_start, set_new_validators
- Same hover/click interaction as the main timeline

## Implementation

### Backend

**Models:**
- Added `epoch_stages: Optional[Dict[str, Any]]` to TimelineResponse
- Added `next_epoch_stages: Optional[Dict[str, Any]]` to TimelineResponse
- These are optional Pydantic response fields, NOT database fields

**Service:**
- Updated `get_timeline()` in service.py to fetch `/v1/epochs/latest`
- Extracts `epoch_stages` and `next_epoch_stages` from API response
- Includes both in TimelineResponse

**Important:** No database changes required. Timeline data is fetched fresh on each request, not cached.

### Frontend

**Types:**
- Extended `TimelineResponse` interface with:
  - `epoch_stages?: { inference_validation_cutoff, next_poc_start, ... }`
  - `next_epoch_stages?: { set_new_validators, ... }`

**Timeline Component:**
- Added new card section "Next Epoch"
- Positioned AFTER Network Events section (at the end)
- Added ref for auto-scrolling when height parameter is provided
- Range calculation:
  - minBlock = current_block.height
  - maxBlock = current_block.height + epoch_length
- SVG rendering (280px height for better spacing):
  - Light red background area between inference_validation_cutoff and set_new_validators (#FEE2E2, 50% opacity)
  - Vertical ticks every 100 blocks (stroke #D1D5DB, opacity 0.3)
  - Current block marker (black, bold vertical line)
  - Target block marker (purple, dashed, when height param provided)
  - Future event lines (blue, dashed) with alternating label positions:
    - "Val Cutoff" - Inference Validation Cutoff (even index, bottom)
    - "PoC Start" - Next PoC Start (odd index, top)
    - "New Validators" - Set New Validators (even index, bottom)
- Countdown timer display:
  - Shows when `?height=X` parameter provided
  - Displays time remaining in human-readable format
  - Shows blocks remaining
  - Updates every second
  - Positioned in header next to title
- Hover interaction:
  - Updated calculateBlockTime() to return both UTC and local time
  - Shows tooltip with block height, UTC time, and local time (on separate lines)
  - Yellow highlight line for hovered position
- Click interaction:
  - Updates URL with ?block= parameter
- URL parameter handling:
  - `?block=X` - Highlights block, shows countdown timer if in range, auto-scrolls to detailed timeline, shows purple target marker
  - `?height=X` - Same behavior as ?block= (auto-scrolls, countdown timer, target marker)

## Technical Details

### URL Parameters
Supports two URL parameters with identical behavior:
- `?block=X` - If block X is in detailed timeline range:
  - Auto-scrolls to detailed timeline section
  - Shows countdown timer to that block
  - Highlights target block with purple marker
  - Updates every second
- `?height=X` - Same behavior as ?block=X

Both parameters provide the same functionality for linking to specific future blocks.

### Block Tick Logic
```typescript
const tickBlocks = []
const firstTick = Math.ceil(detailedMinBlock / 100) * 100
for (let block = firstTick; block <= detailedMaxBlock; block += 100) {
  tickBlocks.push(block)
}
```

### Event Filtering
Only shows events where:
- block_height > current_block.height (future only)
- block_height <= detailedMaxBlock (within range)

### Countdown Timer
When `?height=X` is provided and X is in the detailed timeline range:
- Calculates estimated current block based on elapsed time
- Shows time remaining: "Xd Xh Xm Xs" format
- Shows blocks remaining
- Updates every second
- Displays "Block X has passed" if target is in the past

### Visual Style
- Matches existing timeline aesthetics
- Gray baseline: #E5E7EB
- Tick marks: #D1D5DB with 0.3 opacity
- Event lines: #3B82F6 (blue) with dashed style
- Current block: #111827 (black) with bold stroke
- Target block (height param): #8B5CF6 (purple) with dashed style
- Hover highlight: #F59E0B (orange) with 0.5 opacity
- Countdown timer: Blue text with blocks remaining

## Data Flow

1. User visits Timeline page
2. Frontend calls `/api/v1/timeline`
3. Backend fetches:
   - Current block data
   - Reference block data (10000 blocks ago)
   - Latest epoch info from `/v1/epochs/latest` including epoch_stages and next_epoch_stages
4. Backend returns TimelineResponse with all data
5. Frontend renders both timelines:
   - 2-month overview timeline (unchanged)
   - Detailed next-epoch timeline (new)
6. User hovers over timeline to see block heights and estimated times
7. User clicks to update URL with ?block= parameter

## Performance Optimizations

### Backend Caching (3-minute TTL)
- Timeline data cached in-memory in `InferenceService` instance
- Cache TTL: 180 seconds (3 minutes)
- Reduces 5 API calls per request to 0 when cache is valid
- Logs cache hits and misses for monitoring

### Frontend Caching
- Fetches data only once on initial load
- Uses ref-based tracking to prevent re-fetching within 3-minute window
- Auto-refresh every 3 minutes via setInterval
- Client-side time approximation using initial block data + elapsed time
- Visual indicator shows when data was cached and refresh interval

### Block Time Approximation
- Initial fetch provides: current_block.height, current_block.timestamp, avg_block_time
- Client calculates: `estimated_block = initial_block + (elapsed_seconds / avg_block_time)`
- All countdowns and timers use client-side approximation
- No need to fetch new blocks constantly - just approximate based on time

## Key Design Decisions

1. **3-minute cache** - Timeline data cached for 3 minutes on backend, auto-refreshes on frontend
2. **No database changes** - Only API response model updates
3. **Reuse existing patterns** - Same hover/click behavior as main timeline
4. **Minimalistic style** - Subtle tick marks, consistent colors
5. **Event filtering** - Only show relevant future events within range
6. **Single fetch** - All data comes in one API call, no additional requests
7. **Positioning** - Above 2-month timeline, as second section after info cards
8. **Static view** - No auto-refresh, updates only on page visit

## Files Modified

**Backend:**
- `backend/src/backend/models.py` - Added epoch_stages and next_epoch_stages to TimelineResponse
- `backend/src/backend/service.py` - Updated get_timeline() to fetch and include epoch stages

**Frontend:**
- `frontend/src/types/inference.ts` - Added epoch_stages and next_epoch_stages to TimelineResponse interface
- `frontend/src/components/Timeline.tsx` - Added detailed timeline section with ticks and events

**Planning:**
- `planning/task-16.md` - This file

## Visual Layout

```
[Existing Info Cards]
[Next Epoch Timeline]
  - Light red background for validation period
  - Vertical ticks every 100 blocks
  - Current block marker
  - Future event lines with alternating labels (top/bottom)
  - Target block marker (if height parameter)
  - Hover tooltip with block and time
[2-Month Timeline]
[Network Events]
```

## Testing

Manual testing:
1. Navigate to Timeline page
2. Verify "Next Epoch" timeline displays as SECOND section (after info cards, before 2-month timeline)
3. Verify light red background area between validation cutoff and set validators
4. Verify vertical ticks appear every 100 blocks (subtle gray)
5. Verify future events show as blue dashed lines with alternating labels (top/bottom)
6. Verify event labels are readable and not overlapping (left-aligned on left side, right-aligned on right side)
7. Hover over timeline, verify tooltip shows block height, UTC time, and local time
8. Click timeline, verify URL updates with ?block= parameter
9. Verify events only show if they're in the future and within range
8. Test `?height=X` parameter:
   - Visit timeline with `?height=935000` (future block in range)
   - Verify page auto-scrolls to detailed timeline
   - Verify countdown timer appears in header
   - Verify purple "Target Block" marker appears on timeline
   - Verify countdown updates every second
9. Test with height outside range:
   - Visit with `?height=1000000` (far future)
   - Verify no countdown or marker appears
10. Test with past height:
    - Visit with `?height=900000` (past block)
    - Verify "Block X has passed" message appears

Backend testing:
```bash
curl http://localhost:8000/api/v1/timeline | jq '.epoch_stages, .next_epoch_stages'
```

## Notes

- Timeline shows exactly one epoch into the future (15391 blocks currently)
- Positioned as SECOND section (after info cards, before 2-month timeline) for logical flow (next epoch → longer term → past events)
- Vertical ticks provide reference points every 100 blocks
- Future events highlight key moments: validation cutoff, PoC start, validator changes
- Light red background (#FEE2E2) highlights the validation/PoC period for easy identification
- Event labels alternate top/bottom to prevent overlap and improve readability
- Shortened labels ("Val Cutoff", "PoC Start", "New Validators") for cleaner display
- Smart label positioning for events on same row:
  - When multiple events share a row (both top or both bottom)
  - First event: right-aligned (textAnchor="end") with -5px offset
  - Last event: left-aligned (textAnchor="start") with +5px offset
  - Single event on row: uses position-based anchoring (left/center/right)
- Prevents label overlap even when events are close together
- Same interaction model as main timeline for consistency
- No performance impact - data already fetched from Gonka Chain API
- `?height=X` parameter enables deep linking to specific future blocks with countdown timer
- Countdown timer similar to EpochTimer on dashboard, updates every second
- Auto-scroll provides smooth navigation to the detailed timeline when height parameter is used
- Purple color (#8B5CF6) distinguishes target block from other markers
- SVG height increased to 280px for better label spacing
- Consistent time formatting using toLocaleString with options:
  - Format: "Oct 24, 2024, 15:30:45" (24-hour format)
  - UTC time: Same format with " UTC" suffix
  - Local time: Same format with timezone abbreviation (e.g. "PDT", "EST")
  - Both times use identical formatting for easy comparison
- Tooltip shows both UTC and local time for better accessibility across time zones
- Network Events section also displays both UTC and local time
- `?block=X` parameter now works identically to `?height=X` for countdown timer

