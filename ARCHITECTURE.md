# Gonka Tracker Architecture

## Current Architecture

### 1. Backend (FastAPI) - How It Works

**Components:**
- **FastAPI Application** (`app.py`): Main web server
- **InferenceService** (`service.py`): Business logic for fetching and processing chain data
- **GonkaClient** (`client.py`): HTTP client for Gonka Chain API with failover
- **CacheDB** (`database.py`): SQLite database for caching API responses
- **Background Polling Tasks**: Multiple async tasks that periodically fetch data

**Data Flow:**
```
Gonka Chain API → GonkaClient → InferenceService → CacheDB (SQLite) → In-Memory Cache → API Response
```

**Storage:**
- **SQLite** (`cache.db`): Stores cached epoch stats, participant data, jail status, health, rewards, etc.
- **In-Memory**: Caches current epoch data for fast API responses (< 5 minutes)

**Background Tasks:**
- `poll_current_epoch()`: Every 30s - Fetches current epoch stats
- `poll_jail_status()`: Every 120s - Fetches validator jail status
- `poll_node_health()`: Every 60s - Checks node health endpoints
- `poll_rewards()`: Every 60s - Fetches participant rewards
- `poll_warm_keys()`: Every 300s - Fetches authz grants
- `poll_hardware_nodes()`: Every 600s - Fetches hardware info
- `poll_epoch_total_rewards()`: Every 600s - Calculates total rewards
- `poll_participant_inferences()`: Every 1200s - Fetches inference data
- `poll_models_api()`: Every 300s - Fetches models data
- `poll_timeline()`: Every 30s - Fetches timeline/epoch info
- `poll_confirmation_data()`: Every 120s - Fetches confirmation data
- `monitor_block_height()`: Every 30s - Monitors block height for alerts

**API Endpoints:**
- `/v1/inference/current` - Current epoch stats (cached, < 5min old)
- `/v1/inference/epochs/{id}` - Historical epoch stats
- `/v1/participants/{id}` - Participant details
- `/v1/timeline` - Epoch timeline
- `/v1/models/current` - Current models
- `/v1/models/epochs/{id}` - Historical models

### 2. PostgreSQL Collector - How It Works

**Component:**
- **collect_metrics.py**: Separate Python script that runs independently

**Data Flow:**
```
FastAPI Backend API → collect_metrics.py → PostgreSQL (TimescaleDB) → Grafana
```

**Process:**
1. Script runs in a loop every 30 seconds (configurable)
2. Makes HTTP GET requests to FastAPI endpoints:
   - `GET /api/v1/inference/current` - Gets current epoch data
   - `GET /api/v1/participants/{id}?epoch_id=X` - Gets participant rewards
3. Transforms API response data into metrics
4. Writes to PostgreSQL tables:
   - `node_metrics` - Per-node metrics (inferences, rewards, health, etc.)
   - `network_metrics` - Aggregate network metrics (total nodes, total inferences, etc.)
   - `participant_rewards` - Historical rewards per participant per epoch

**Issues:**
- **Extra Network Hop**: Collector → API → SQLite → Chain API (inefficient)
- **Data Duplication**: Same data stored in SQLite (backend) and PostgreSQL (metrics)
- **Potential Inconsistency**: Data in SQLite and PostgreSQL can differ
- **Tight Coupling**: Collector depends on API being available
- **No Direct Access**: Can't query SQLite directly for metrics
- **Latency**: API call adds latency to metrics collection

## Problems with Current Design

1. **Dual Storage Systems**
   - SQLite for API caching
   - PostgreSQL for metrics
   - Data duplication and potential inconsistency

2. **Inefficient Data Flow**
   - Chain API → Backend → SQLite → API → Collector → PostgreSQL
   - Should be: Chain API → Backend → PostgreSQL (both caching and metrics)

3. **Tight Coupling**
   - Collector script depends on API availability
   - If API is down, metrics collection stops

4. **Resource Waste**
   - Same data fetched twice (once for API, once for metrics)
   - Network overhead from API calls

5. **Complexity**
   - Two separate processes to maintain
   - Two database systems to manage
   - More failure points

## Recommended Better Design

### Option 1: Unified PostgreSQL Backend (Recommended)

**Architecture:**
```
Gonka Chain API → GonkaClient → InferenceService → PostgreSQL (TimescaleDB)
                                                      ↓
                                              API Responses + Metrics Storage
                                                      ↓
                                              Grafana (direct queries)
```

**Changes:**
1. **Replace SQLite with PostgreSQL**
   - Use PostgreSQL for both caching and metrics
   - Leverage TimescaleDB for time-series optimization
   - Single source of truth

2. **Direct Metrics Writing**
   - Write metrics directly to PostgreSQL from backend polling tasks
   - No separate collector script needed
   - Metrics written at the same time as data is fetched

3. **Unified Database Schema**
   - Keep existing `node_metrics`, `network_metrics`, `participant_rewards` tables
   - Add caching tables: `epoch_cache`, `participant_cache`, etc.
   - Use PostgreSQL's JSONB for flexible caching

4. **Benefits:**
   - ✅ Single database system
   - ✅ No data duplication
   - ✅ Consistent data
   - ✅ Lower latency (no API hop)
   - ✅ Simpler architecture
   - ✅ Better performance (direct DB writes)
   - ✅ Easier to maintain

**Implementation:**
- Create `PostgresDB` class similar to `CacheDB`
- Modify `InferenceService` to write to PostgreSQL
- Add metrics writing to existing polling tasks
- Remove `collect_metrics.py` script
- Update Grafana to query same PostgreSQL instance

### Option 2: Event-Driven Architecture

**Architecture:**
```
Gonka Chain API → Backend → PostgreSQL (write) → PostgreSQL Notify → Collector (optional)
                                                      ↓
                                              Grafana (direct queries)
```

**Changes:**
1. **Backend writes to PostgreSQL** (same as Option 1)
2. **Optional Collector** for additional processing
3. **PostgreSQL LISTEN/NOTIFY** for real-time updates
4. **Event-driven metrics** instead of polling

**Benefits:**
- ✅ Real-time updates
- ✅ More efficient
- ✅ Scalable

**Drawbacks:**
- More complex to implement
- Requires PostgreSQL LISTEN/NOTIFY setup

### Option 3: Hybrid Approach (Minimal Changes)

**Keep current architecture but:**
1. **Backend writes metrics directly to PostgreSQL**
   - Add metrics writing to existing polling tasks
   - Keep SQLite for API response caching
   - Write metrics in parallel

2. **Keep collector as backup/validation**
   - Use collector to validate data consistency
   - Or remove collector entirely

**Benefits:**
- ✅ Minimal code changes
- ✅ Can be done incrementally
- ✅ Backward compatible

**Drawbacks:**
- Still has dual storage (but metrics go directly to PostgreSQL)
- Some data duplication remains

## Recommended Migration Path

### Phase 1: Add PostgreSQL Support to Backend
1. Create `PostgresDB` class
2. Add metrics writing to existing polling tasks
3. Write metrics in parallel with SQLite caching
4. Keep collector running for validation

### Phase 2: Migrate Caching to PostgreSQL
1. Replace SQLite `CacheDB` with PostgreSQL
2. Use JSONB columns for flexible caching
3. Update all cache operations

### Phase 3: Remove Collector Script
1. Verify all metrics are being written correctly
2. Remove `collect_metrics.py`
3. Update documentation

### Phase 4: Optimize
1. Add database indexes
2. Optimize queries
3. Add connection pooling
4. Consider materialized views for common queries

## Code Structure Suggestion

```
backend/src/backend/
├── database.py          # Unified PostgreSQL database class
├── models.py            # Data models
├── service.py           # Business logic (writes to PostgreSQL)
├── client.py            # Gonka Chain API client
├── app.py               # FastAPI app (reads from PostgreSQL)
└── router.py            # API routes
```

**Key Changes:**
- `database.py`: Replace SQLite with PostgreSQL, add metrics tables
- `service.py`: Add metrics writing to polling tasks
- Remove `collect_metrics.py` script
- Grafana queries PostgreSQL directly (no changes needed)

## Benefits Summary

| Aspect | Current | Recommended |
|--------|---------|-------------|
| Databases | 2 (SQLite + PostgreSQL) | 1 (PostgreSQL) |
| Processes | 2 (Backend + Collector) | 1 (Backend) |
| Data Flow | Chain → Backend → SQLite → API → Collector → PostgreSQL | Chain → Backend → PostgreSQL |
| Latency | High (API hop) | Low (direct write) |
| Consistency | Potential issues | Guaranteed |
| Maintenance | Complex | Simple |
| Performance | Lower | Higher |
