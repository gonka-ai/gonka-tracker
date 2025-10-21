# Task 14: Models Page

## Task
Add a new Models page displaying all available models on Gonka Chain with aggregated ML node weights, participant counts, and usage statistics. Includes table view with epoch selector and detailed model modal.

## Status
IMPLEMENTED

## Result
Models page implemented with:
- Backend endpoints `/v1/models/current` and `/v1/models/epochs/{epoch_id}`
- Per-epoch caching of model weight aggregations
- Frontend Models page with epoch selector and auto-refresh
- ModelModal component for detailed model information
- Navigation integration with Host Dashboard and Timeline

## Implementation

### Backend

**Database:**
- Added `models` table with columns:
  - epoch_id INTEGER
  - model_id TEXT
  - total_weight INTEGER
  - participant_count INTEGER
  - cached_at TEXT
  - PRIMARY KEY (epoch_id, model_id)
- Added methods:
  - `save_models_batch(epoch_id, models_data)` - save aggregated model weights
  - `get_models(epoch_id)` - retrieve cached models for epoch

**Models:**
- Added `ModelInfo` Pydantic model with fields:
  - id, total_weight, participant_count
  - proposed_by, v_ram, throughput_per_nonce, units_of_compute_per_token
  - hf_repo, hf_commit, model_args, validation_threshold
- Added `ModelStats` model: model, ai_tokens, inferences
- Added `ModelsResponse` model: epoch_id, height, models, stats, cached_at, is_current

**Client:**
- Added `get_models_all()` - fetch from `/chain-api/.../models_all`
- Added `get_models_stats()` - fetch from `/chain-api/.../models_stats_by_time`

**Service:**
- Added `get_current_models()`:
  - Fetches current epoch stats for participants data
  - Checks models cache for current epoch_id
  - If cache miss:
    - Fetches models_all from API
    - Aggregates weights from participants' ml_nodes_map and hardware_nodes
    - Fetches models_stats from API
    - Caches results with epoch_id
  - Returns ModelsResponse with is_current=True
  
- Added `get_historical_models(epoch_id, height)`:
  - Fetches historical epoch stats for participants data
  - Same caching and aggregation logic as current
  - Returns ModelsResponse with is_current=False

**Router:**
- Added `GET /v1/models/current` endpoint
- Added `GET /v1/models/epochs/{epoch_id}` endpoint

### Frontend

**Types:**
- Added `ModelInfo` interface
- Added `ModelStats` interface
- Added `ModelsResponse` interface

**Components:**
- Created `Models.tsx` page component:
  - State management: selectedEpochId, currentEpochId, selectedModelId
  - Fetch logic:
    - `/api/v1/models/current` when selectedEpochId is null
    - `/api/v1/models/epochs/{id}` when selectedEpochId is set
  - Epoch info card (epoch_id, height, CURRENT badge, total models)
  - EpochSelector component for epoch navigation
  - Auto-refresh every 30s when viewing current epoch
  - Table with columns: Model ID, Total Weight, Hosts, Inferences, AI Tokens
  - Sorted by total_weight descending
  - Click row to open modal
  - URL parameter handling (`?page=models&epoch=X&model=Y`)

- Created `ModelModal.tsx` component:
  - Display model ID, total weight, participant count
  - Display usage stats (inferences, AI tokens)
  - Display technical details:
    - Proposed by address
    - VRAM, throughput, compute units
    - HuggingFace repo (clickable link) and commit
    - Model arguments
    - Validation threshold
  - Close on backdrop click or X button

**App:**
- Added 'models' to Page type union
- Added Models navigation button (between Dashboard and Timeline)
- Added conditional rendering for Models page
- Updated URL routing to handle `?page=models`
- Models page manages its own epoch state (independent from Dashboard)

## Data Flow

**Current Epoch:**
1. User navigates to Models page or clicks Models button
2. Frontend calls `GET /api/v1/models/current`
3. Backend calls `get_current_epoch_participants()` to get participants with models and ml_nodes
4. Backend checks models cache for current epoch_id
5. If cache miss:
   - Iterate through participants
   - Zip each participant's models array with ml_nodes array
   - For each model, sum up poc_weight from ml_nodes
   - Count unique participants per model
   - Fetch models_all and models_stats from chain API
   - Cache aggregated data with epoch_id
6. Return ModelsResponse with is_current=True
7. Frontend displays with CURRENT badge, auto-refresh enabled

**Historical Epoch:**
1. User selects epoch via EpochSelector
2. Frontend calls `GET /api/v1/models/epochs/{epoch_id}`
3. Backend calls `get_epoch_participants(epoch_id)` to get participants
4. Backend checks models cache for that epoch_id
5. If cache miss: same aggregation process as current
6. Return ModelsResponse with is_current=False
7. Frontend displays without auto-refresh

**Model Details:**
1. User clicks model row
2. ModelModal opens with full model details
3. Stats matched from stats array by model ID
4. URL updated with `?model={id}` parameter

## Weight Aggregation Logic

```python
model_weights: Dict[str, int] = {}
model_participant_count: Dict[str, set] = {}

for participant in participants:
    participant_index = participant["index"]
    models = participant.get("models", [])
    ml_nodes_high_level = participant.get("ml_nodes", [])
    
    for model, ml_nodes_entry in zip(models, ml_nodes_high_level):
        if model not in model_weights:
            model_weights[model] = 0
            model_participant_count[model] = set()
        
        for ml_node in ml_nodes_entry.get("ml_nodes", []):
            poc_weight = ml_node.get("poc_weight", 0)
            model_weights[model] += poc_weight
        
        model_participant_count[model].add(participant_index)
```

## Key Design Decisions

1. **Per-epoch cache** - Models cached by epoch_id for consistency with participants data
2. **Simple aggregation** - Directly use epoch participants data, no additional API calls needed
3. **Models array pairing** - Each participant's `models` array is zipped with `ml_nodes` array
4. **No TTL on cache** - Cache is epoch-specific, invalidated when epoch changes
5. **Combined endpoint** - Models + stats in single response (not much data)
6. **Table sorting** - Default sort by total_weight descending
7. **Participant count** - Tracks unique participants supporting each model (set deduplication)
8. **Epoch selector** - Same UX as Dashboard for consistency
9. **Auto-refresh** - Only on current epoch, every 30s like Dashboard
10. **URL routing** - Supports `?page=models&epoch=X&model=Y` for deep linking

## API Response Example

```json
{
  "epoch_id": 57,
  "height": 925678,
  "is_current": true,
  "cached_at": "2025-10-21T12:34:56.789Z",
  "models": [
    {
      "id": "Qwen/Qwen3-32B-FP8",
      "total_weight": 42500,
      "participant_count": 12,
      "proposed_by": "gonka10d07y265gmmuvt4z0w9aw880jnsr700j2h5m33",
      "v_ram": "80",
      "throughput_per_nonce": "6000",
      "units_of_compute_per_token": "1000",
      "hf_repo": "Qwen/Qwen3-32B-FP8",
      "hf_commit": "aa55da1ecc13d006e8b8e4f54579b1ea8c3db2df",
      "model_args": [],
      "validation_threshold": {
        "value": "95814",
        "exponent": -5
      }
    }
  ],
  "stats": [
    {
      "model": "Qwen/Qwen3-32B-FP8",
      "ai_tokens": "2338907",
      "inferences": 13807
    }
  ]
}
```

## Files Created/Modified

**Backend:**
- `backend/src/backend/database.py` - Added models table and methods
- `backend/src/backend/models.py` - Added ModelInfo, ModelStats, ModelsResponse
- `backend/src/backend/client.py` - Added get_models_all, get_models_stats
- `backend/src/backend/service.py` - Added get_current_models, get_historical_models
- `backend/src/backend/router.py` - Added /v1/models endpoints

**Frontend:**
- `frontend/src/types/inference.ts` - Added model interfaces
- `frontend/src/components/Models.tsx` - New models page component
- `frontend/src/components/ModelModal.tsx` - New model detail modal
- `frontend/src/App.tsx` - Added models page routing and navigation

**Planning:**
- `planning/task-14.md` - This file

## Minimalism Checklist

- Reuses existing participant cache and hardware_nodes cache
- No new background polling (piggybacks on existing data)
- Per-epoch caching aligns with existing architecture
- Simple aggregation logic using dictionaries
- Frontend follows Dashboard patterns (EpochSelector, auto-refresh, URL routing)
- Modal follows ParticipantModal patterns
- No custom styling, uses existing Tailwind classes
- Minimal API calls (two endpoints, both cached)
- No redundant data fetching

## Testing

Manual testing:
1. Navigate to Models page via button
2. Verify models table displays with correct data
3. Click model row, verify modal opens with details
4. Use epoch selector, verify historical epochs load
5. Verify auto-refresh on current epoch (30s countdown)
6. Verify URL parameters work (`?page=models&epoch=56&model=Qwen/Qwen3-32B-FP8`)
7. Verify total weight aggregation is correct
8. Verify participant count matches unique hosts

Backend testing:
```bash
# Test current models endpoint
curl http://localhost:8000/api/v1/models/current | jq

# Test historical models endpoint
curl http://localhost:8000/api/v1/models/epochs/56 | jq

# Verify database
sqlite3 backend/cache.db "SELECT * FROM models WHERE epoch_id=57"
```

## Notes

- Model weights are specific to each epoch based on participants active in that epoch
- Models stats (inferences, tokens) are global/current from the chain API
- Weight aggregation uses epoch participants data directly (no additional caching needed)
- Modal displays technical details useful for operators and developers
- HuggingFace repo links enable easy navigation to model documentation

## Important: Weight Aggregation Behavior

**Simple and direct**: The weight aggregation logic uses data directly from the epoch participants API:

1. **Data source**: All model and weight data comes from the epoch participants response
2. **Array pairing**: Each participant has `models` array paired with `ml_nodes` array via zip()
3. **Weight totals match**: Sum of model weights equals sum of participant weights (307,495 in epoch 58)
4. **No extra API calls**: No need to fetch hardware_nodes separately - all data is in epoch participants

This is the SIMPLEST correct implementation following the `.cursorrules` philosophy.

