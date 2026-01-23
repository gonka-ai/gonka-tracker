# Implementation Guide: Network Monitoring Dashboard with Alerts

This guide provides step-by-step instructions for implementing the network monitoring dashboard with alert functionality.

## Prerequisites

- Existing gonka-tracker backend and frontend
- PostgreSQL database (for time-series data)
- Node.js and Python development environment

## Phase 1: Database Setup

### Step 1.1: Install TimescaleDB Extension

```bash
# On Ubuntu/Debian
sudo apt-get install postgresql-14-timescaledb

# Enable extension in PostgreSQL
psql -U postgres -d gonka_tracker -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
```

### Step 1.2: Create Time-Series Tables

Create a new migration file: `backend/migrations/001_create_timeseries_tables.sql`

```sql
-- Node metrics table
CREATE TABLE IF NOT EXISTS node_metrics (
    time TIMESTAMPTZ NOT NULL,
    node_address TEXT NOT NULL,
    epoch_id INTEGER,
    block_height INTEGER,
    
    inference_count BIGINT,
    missed_requests BIGINT,
    validated_inferences BIGINT,
    invalidated_inferences BIGINT,
    earned_coins BIGINT,
    rewarded_coins BIGINT,
    weight INTEGER,
    
    missed_rate DECIMAL(5,4),
    invalidation_rate DECIMAL(5,4),
    
    is_jailed BOOLEAN,
    node_healthy BOOLEAN,
    
    PRIMARY KEY (time, node_address)
);

-- Create hypertable
SELECT create_hypertable('node_metrics', 'time', if_not_exists => TRUE);

-- Network aggregate metrics
CREATE TABLE IF NOT EXISTS network_metrics (
    time TIMESTAMPTZ NOT NULL,
    epoch_id INTEGER,
    block_height INTEGER,
    
    total_nodes INTEGER,
    active_nodes INTEGER,
    total_weight BIGINT,
    total_inferences BIGINT,
    total_missed BIGINT,
    avg_missed_rate DECIMAL(5,4),
    avg_invalidation_rate DECIMAL(5,4),
    
    PRIMARY KEY (time)
);

SELECT create_hypertable('network_metrics', 'time', if_not_exists => TRUE);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    
    target_type TEXT NOT NULL,
    node_address TEXT,
    
    metric TEXT NOT NULL,
    current_value DECIMAL,
    threshold_value DECIMAL,
    deviation_percent DECIMAL,
    message TEXT NOT NULL,
    
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by TEXT,
    
    metadata JSONB
);

CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_node ON alerts(node_address);
CREATE INDEX idx_alerts_created ON alerts(created_at);
CREATE INDEX idx_alerts_rule ON alerts(rule_id);

-- Alert rules table
CREATE TABLE IF NOT EXISTS alert_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    type TEXT NOT NULL,
    
    target TEXT NOT NULL,
    node_address TEXT,
    
    metric TEXT NOT NULL,
    
    threshold_config JSONB,
    pattern_config JSONB,
    comparative_config JSONB,
    
    notification_config JSONB NOT NULL,
    cooldown_minutes INTEGER DEFAULT 30,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Step 1.3: Create Database Models

Create `backend/src/backend/timeseries_models.py`:

```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal

class NodeMetric(BaseModel):
    time: datetime
    node_address: str
    epoch_id: Optional[int]
    block_height: Optional[int]
    inference_count: Optional[int]
    missed_requests: Optional[int]
    validated_inferences: Optional[int]
    invalidated_inferences: Optional[int]
    earned_coins: Optional[int]
    rewarded_coins: Optional[int]
    weight: Optional[int]
    missed_rate: Optional[Decimal]
    invalidation_rate: Optional[Decimal]
    is_jailed: Optional[bool]
    node_healthy: Optional[bool]

class NetworkMetric(BaseModel):
    time: datetime
    epoch_id: Optional[int]
    block_height: Optional[int]
    total_nodes: int
    active_nodes: int
    total_weight: int
    total_inferences: int
    total_missed: int
    avg_missed_rate: Decimal
    avg_invalidation_rate: Decimal
```

## Phase 2: Data Collection Service

### Step 2.1: Create Metrics Collector

Create `backend/src/backend/metrics_collector.py`:

```python
import asyncio
import asyncpg
from datetime import datetime
from typing import List, Optional
from backend.models import InferenceResponse, ParticipantStats
from backend.database import CacheDB
import logging

logger = logging.getLogger(__name__)

class MetricsCollector:
    def __init__(self, db_pool: asyncpg.Pool, inference_service):
        self.db_pool = db_pool
        self.inference_service = inference_service
    
    async def collect_node_metrics(self, inference_data: InferenceResponse):
        """Collect and store node metrics"""
        async with self.db_pool.acquire() as conn:
            for participant in inference_data.participants:
                await conn.execute("""
                    INSERT INTO node_metrics (
                        time, node_address, epoch_id, block_height,
                        inference_count, missed_requests, validated_inferences,
                        invalidated_inferences, earned_coins, rewarded_coins,
                        weight, missed_rate, invalidation_rate,
                        is_jailed, node_healthy
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                """,
                    datetime.utcnow(),
                    participant.address,
                    inference_data.epoch_id,
                    inference_data.height,
                    int(participant.current_epoch_stats.inference_count),
                    int(participant.current_epoch_stats.missed_requests),
                    int(participant.current_epoch_stats.validated_inferences),
                    int(participant.current_epoch_stats.invalidated_inferences),
                    int(participant.current_epoch_stats.earned_coins),
                    int(participant.current_epoch_stats.rewarded_coins),
                    participant.weight,
                    participant.missed_rate,
                    participant.invalidation_rate,
                    participant.is_jailed,
                    participant.node_healthy
                )
    
    async def collect_network_metrics(self, inference_data: InferenceResponse):
        """Collect and store network aggregate metrics"""
        participants = inference_data.participants
        
        total_nodes = len(participants)
        active_nodes = sum(1 for p in participants if not p.is_jailed and p.node_healthy)
        total_weight = sum(p.weight for p in participants)
        total_inferences = sum(int(p.current_epoch_stats.inference_count) for p in participants)
        total_missed = sum(int(p.current_epoch_stats.missed_requests) for p in participants)
        
        total_requests = total_inferences + total_missed
        avg_missed_rate = (total_missed / total_requests) if total_requests > 0 else 0
        
        total_invalidated = sum(int(p.current_epoch_stats.invalidated_inferences) for p in participants)
        avg_invalidation_rate = (total_invalidated / total_inferences) if total_inferences > 0 else 0
        
        async with self.db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO network_metrics (
                    time, epoch_id, block_height,
                    total_nodes, active_nodes, total_weight,
                    total_inferences, total_missed,
                    avg_missed_rate, avg_invalidation_rate
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            """,
                datetime.utcnow(),
                inference_data.epoch_id,
                inference_data.height,
                total_nodes,
                active_nodes,
                total_weight,
                total_inferences,
                total_missed,
                avg_missed_rate,
                avg_invalidation_rate
            )
    
    async def collect_metrics(self):
        """Main collection method"""
        try:
            inference_data = await self.inference_service.get_current_epoch_stats(reload=False)
            await self.collect_node_metrics(inference_data)
            await self.collect_network_metrics(inference_data)
            logger.info("Metrics collected successfully")
        except Exception as e:
            logger.error(f"Error collecting metrics: {e}")
```

### Step 2.2: Integrate into App Lifecycle

Update `backend/src/backend/app.py`:

```python
# Add to imports
from backend.metrics_collector import MetricsCollector
import asyncpg

# Add to lifespan function
async def lifespan(app: FastAPI):
    # ... existing code ...
    
    # Create PostgreSQL connection pool for time-series data
    db_pool = await asyncpg.create_pool(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", ""),
        database=os.getenv("POSTGRES_DB", "gonka_tracker"),
        min_size=2,
        max_size=10
    )
    
    # Create metrics collector
    metrics_collector = MetricsCollector(db_pool, inference_service_instance)
    
    # Start metrics collection task
    async def collect_metrics_task():
        while True:
            try:
                await metrics_collector.collect_metrics()
            except Exception as e:
                logger.error(f"Metrics collection error: {e}")
            await asyncio.sleep(30)  # Collect every 30 seconds
    
    metrics_task = asyncio.create_task(collect_metrics_task())
    
    yield
    
    # Cleanup
    metrics_task.cancel()
    await db_pool.close()
```

## Phase 3: Alert Engine

### Step 3.1: Create Alert Engine

Create `backend/src/backend/alert_engine.py`:

```python
import asyncio
import asyncpg
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

class AlertEngine:
    def __init__(self, db_pool: asyncpg.Pool, inference_service):
        self.db_pool = db_pool
        self.inference_service = inference_service
    
    async def evaluate_threshold_rule(self, rule: Dict[str, Any], current_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Evaluate a threshold-based alert rule"""
        metric = rule['metric']
        threshold = rule['threshold_config']
        
        current_value = current_data.get(metric)
        if current_value is None:
            return None
        
        operator = threshold['operator']
        threshold_value = Decimal(str(threshold['value']))
        current_decimal = Decimal(str(current_value))
        
        triggered = False
        if operator == 'gt':
            triggered = current_decimal > threshold_value
        elif operator == 'lt':
            triggered = current_decimal < threshold_value
        elif operator == 'gte':
            triggered = current_decimal >= threshold_value
        elif operator == 'lte':
            triggered = current_decimal <= threshold_value
        elif operator == 'eq':
            triggered = current_decimal == threshold_value
        
        if triggered:
            return {
                'rule_id': rule['id'],
                'alert_type': 'threshold',
                'severity': rule['notification_config']['severity'],
                'target_type': rule['target'],
                'node_address': rule.get('node_address'),
                'metric': metric,
                'current_value': float(current_decimal),
                'threshold_value': float(threshold_value),
                'message': f"{metric} {operator} {threshold_value}: current={current_decimal}"
            }
        
        return None
    
    async def evaluate_pattern_rule(self, rule: Dict[str, Any], historical_data: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Evaluate a pattern-based alert rule"""
        if len(historical_data) < 10:
            return None
        
        pattern_config = rule['pattern_config']
        method = pattern_config['method']
        metric = rule['metric']
        
        values = [float(d[metric]) for d in historical_data if d.get(metric) is not None]
        
        if method == 'z_score':
            return self._detect_z_score_anomaly(values, rule, pattern_config)
        elif method == 'moving_avg':
            return self._detect_moving_avg_deviation(values, rule, pattern_config)
        elif method == 'rate_of_change':
            return self._detect_rate_of_change(values, rule, pattern_config)
        
        return None
    
    def _detect_z_score_anomaly(self, values: List[float], rule: Dict, config: Dict) -> Optional[Dict]:
        if len(values) < 10:
            return None
        
        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / len(values)
        std = variance ** 0.5
        
        if std == 0:
            return None
        
        latest = values[-1]
        z_score = abs((latest - mean) / std)
        threshold = config.get('sensitivity', 2.0)  # Default 2σ
        
        if z_score > threshold:
            return {
                'rule_id': rule['id'],
                'alert_type': 'pattern',
                'severity': rule['notification_config']['severity'],
                'target_type': rule['target'],
                'node_address': rule.get('node_address'),
                'metric': rule['metric'],
                'current_value': latest,
                'message': f"Z-score anomaly detected: {z_score:.2f}σ (threshold: {threshold}σ)"
            }
        
        return None
    
    def _detect_moving_avg_deviation(self, values: List[float], rule: Dict, config: Dict) -> Optional[Dict]:
        window = config.get('window', 20)
        threshold_percent = config.get('sensitivity', 20)  # 20% deviation
        
        if len(values) < window + 1:
            return None
        
        recent = values[-window:]
        ma = sum(recent) / len(recent)
        current = values[-1]
        
        if ma == 0:
            return None
        
        deviation = abs((current - ma) / ma) * 100
        
        if deviation > threshold_percent:
            return {
                'rule_id': rule['id'],
                'alert_type': 'pattern',
                'severity': rule['notification_config']['severity'],
                'target_type': rule['target'],
                'node_address': rule.get('node_address'),
                'metric': rule['metric'],
                'current_value': current,
                'deviation_percent': deviation,
                'message': f"Moving average deviation: {deviation:.1f}% (threshold: {threshold_percent}%)"
            }
        
        return None
    
    def _detect_rate_of_change(self, values: List[float], rule: Dict, config: Dict) -> Optional[Dict]:
        threshold_percent = config.get('sensitivity', 30)  # 30% change
        
        if len(values) < 2:
            return None
        
        previous = values[-2]
        current = values[-1]
        
        if previous == 0:
            return None
        
        change_percent = abs((current - previous) / previous) * 100
        
        if change_percent > threshold_percent:
            return {
                'rule_id': rule['id'],
                'alert_type': 'pattern',
                'severity': rule['notification_config']['severity'],
                'target_type': rule['target'],
                'node_address': rule.get('node_address'),
                'metric': rule['metric'],
                'current_value': current,
                'deviation_percent': change_percent,
                'message': f"Rate of change detected: {change_percent:.1f}% (threshold: {threshold_percent}%)"
            }
        
        return None
    
    async def get_active_alerts_for_rule(self, rule_id: str) -> List[Dict]:
        """Get active alerts for a rule"""
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT * FROM alerts
                WHERE rule_id = $1 AND status = 'active'
                ORDER BY created_at DESC
            """, rule_id)
            return [dict(row) for row in rows]
    
    async def create_alert(self, alert_data: Dict):
        """Create a new alert"""
        async with self.db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO alerts (
                    rule_id, alert_type, severity,
                    target_type, node_address,
                    metric, current_value, threshold_value,
                    deviation_percent, message, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            """,
                alert_data['rule_id'],
                alert_data['alert_type'],
                alert_data['severity'],
                alert_data['target_type'],
                alert_data.get('node_address'),
                alert_data['metric'],
                alert_data.get('current_value'),
                alert_data.get('threshold_value'),
                alert_data.get('deviation_percent'),
                alert_data['message'],
                'active'
            )
    
    async def resolve_alert(self, alert_id: str):
        """Resolve an alert"""
        async with self.db_pool.acquire() as conn:
            await conn.execute("""
                UPDATE alerts
                SET status = 'resolved', resolved_at = NOW()
                WHERE id = $1
            """, alert_id)
    
    async def evaluate_all_rules(self):
        """Evaluate all enabled alert rules"""
        async with self.db_pool.acquire() as conn:
            rules = await conn.fetch("""
                SELECT * FROM alert_rules WHERE enabled = TRUE
            """)
        
        inference_data = await self.inference_service.get_current_epoch_stats(reload=False)
        
        for rule_row in rules:
            rule = dict(rule_row)
            
            # Check cooldown
            active_alerts = await self.get_active_alerts_for_rule(rule['id'])
            if active_alerts:
                # Check if within cooldown period
                latest_alert = active_alerts[0]
                cooldown_minutes = rule.get('cooldown_minutes', 30)
                if latest_alert['created_at'] > datetime.utcnow() - timedelta(minutes=cooldown_minutes):
                    continue
            
            # Evaluate based on rule type
            if rule['type'] == 'threshold':
                # Get current data for target
                if rule['target'] == 'all_nodes':
                    for participant in inference_data.participants:
                        current_data = {
                            'missed_rate': participant.missed_rate,
                            'invalidation_rate': participant.invalidation_rate,
                            'inference_count': int(participant.current_epoch_stats.inference_count),
                            'health_status': 1 if participant.node_healthy else 0,
                            'jail_status': 1 if participant.is_jailed else 0,
                            'weight': participant.weight
                        }
                        alert = await self.evaluate_threshold_rule(rule, current_data)
                        if alert:
                            alert['node_address'] = participant.address
                            await self.create_alert(alert)
                elif rule['target'] == 'node' and rule.get('node_address'):
                    # Find specific node
                    participant = next((p for p in inference_data.participants if p.address == rule['node_address']), None)
                    if participant:
                        current_data = {
                            'missed_rate': participant.missed_rate,
                            'invalidation_rate': participant.invalidation_rate,
                            'inference_count': int(participant.current_epoch_stats.inference_count),
                            'health_status': 1 if participant.node_healthy else 0,
                            'jail_status': 1 if participant.is_jailed else 0,
                            'weight': participant.weight
                        }
                        alert = await self.evaluate_threshold_rule(rule, current_data)
                        if alert:
                            await self.create_alert(alert)
            
            # TODO: Implement pattern and comparative rule evaluation
            # This requires fetching historical data from node_metrics table
    
    async def run_evaluation_loop(self):
        """Run alert evaluation in a loop"""
        while True:
            try:
                await self.evaluate_all_rules()
            except Exception as e:
                logger.error(f"Alert evaluation error: {e}")
            await asyncio.sleep(30)  # Evaluate every 30 seconds
```

### Step 3.2: Integrate Alert Engine

Update `backend/src/backend/app.py` to start alert engine:

```python
from backend.alert_engine import AlertEngine

# In lifespan function
alert_engine = AlertEngine(db_pool, inference_service_instance)
alert_task = asyncio.create_task(alert_engine.run_evaluation_loop())
```

## Phase 4: API Endpoints

### Step 4.1: Create Alert Router

Create `backend/src/backend/alert_router.py`:

```python
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel
import asyncpg
from datetime import datetime

router = APIRouter(prefix="/v1/alerts")

db_pool: Optional[asyncpg.Pool] = None

def set_db_pool(pool: asyncpg.Pool):
    global db_pool
    db_pool = pool

class AlertResponse(BaseModel):
    id: str
    rule_id: str
    alert_type: str
    severity: str
    target_type: str
    node_address: Optional[str]
    metric: str
    current_value: Optional[float]
    threshold_value: Optional[float]
    deviation_percent: Optional[float]
    message: str
    status: str
    created_at: datetime
    resolved_at: Optional[datetime]

@router.get("", response_model=List[AlertResponse])
async def get_alerts(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    node_address: Optional[str] = Query(None)
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database not initialized")
    
    query = "SELECT * FROM alerts WHERE 1=1"
    params = []
    param_count = 0
    
    if status:
        param_count += 1
        query += f" AND status = ${param_count}"
        params.append(status)
    
    if severity:
        param_count += 1
        query += f" AND severity = ${param_count}"
        params.append(severity)
    
    if node_address:
        param_count += 1
        query += f" AND node_address = ${param_count}"
        params.append(node_address)
    
    query += " ORDER BY created_at DESC LIMIT 100"
    
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
        return [AlertResponse(**dict(row)) for row in rows]

@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, acknowledged_by: str = "system"):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database not initialized")
    
    async with db_pool.acquire() as conn:
        await conn.execute("""
            UPDATE alerts
            SET acknowledged_at = NOW(), acknowledged_by = $1
            WHERE id = $2
        """, acknowledged_by, alert_id)
    
    return {"status": "acknowledged"}

@router.post("/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database not initialized")
    
    async with db_pool.acquire() as conn:
        await conn.execute("""
            UPDATE alerts
            SET status = 'resolved', resolved_at = NOW()
            WHERE id = $1
        """, alert_id)
    
    return {"status": "resolved"}
```

### Step 4.2: Add Metrics Endpoints

Create `backend/src/backend/metrics_router.py`:

```python
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime, timedelta
import asyncpg

router = APIRouter(prefix="/v1/metrics")

db_pool: Optional[asyncpg.Pool] = None

def set_db_pool(pool: asyncpg.Pool):
    global db_pool
    db_pool = pool

@router.get("/node/{node_address}")
async def get_node_metrics(
    node_address: str,
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    interval: str = Query("1h")
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database not initialized")
    
    if not start_time:
        start_time = datetime.utcnow() - timedelta(hours=24)
    if not end_time:
        end_time = datetime.utcnow()
    
    # Use TimescaleDB time_bucket for aggregation
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                time_bucket($1::interval, time) AS bucket,
                AVG(missed_rate) as avg_missed_rate,
                AVG(invalidation_rate) as avg_invalidation_rate,
                SUM(inference_count) as total_inferences,
                AVG(weight) as avg_weight
            FROM node_metrics
            WHERE node_address = $2 AND time >= $3 AND time <= $4
            GROUP BY bucket
            ORDER BY bucket
        """, interval, node_address, start_time, end_time)
        
        return [dict(row) for row in rows]

@router.get("/network")
async def get_network_metrics(
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    interval: str = Query("1h")
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database not initialized")
    
    if not start_time:
        start_time = datetime.utcnow() - timedelta(hours=24)
    if not end_time:
        end_time = datetime.utcnow()
    
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                time_bucket($1::interval, time) AS bucket,
                AVG(total_nodes) as avg_total_nodes,
                AVG(active_nodes) as avg_active_nodes,
                AVG(avg_missed_rate) as avg_missed_rate,
                AVG(avg_invalidation_rate) as avg_invalidation_rate,
                SUM(total_inferences) as total_inferences
            FROM network_metrics
            WHERE time >= $2 AND time <= $3
            GROUP BY bucket
            ORDER BY bucket
        """, interval, start_time, end_time)
        
        return [dict(row) for row in rows]
```

### Step 4.3: Register Routers

Update `backend/src/backend/app.py`:

```python
from backend.alert_router import router as alert_router, set_db_pool as set_alert_db_pool
from backend.metrics_router import router as metrics_router, set_db_pool as set_metrics_db_pool

# In lifespan function
set_alert_db_pool(db_pool)
set_metrics_db_pool(db_pool)

app.include_router(alert_router)
app.include_router(metrics_router)
```

## Phase 5: Frontend Components

### Step 5.1: Install Chart Library

```bash
cd frontend
npm install recharts
```

### Step 5.2: Create Alert Service

Create `frontend/src/services/alertService.ts`:

```typescript
import { InferenceResponse } from '../types/inference';

const apiUrl = import.meta.env.VITE_API_URL || '/api';

export interface Alert {
  id: string;
  rule_id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  target_type: string;
  node_address?: string;
  metric: string;
  current_value?: number;
  threshold_value?: number;
  deviation_percent?: number;
  message: string;
  status: 'active' | 'resolved' | 'acknowledged';
  created_at: string;
  resolved_at?: string;
}

export async function getAlerts(
  status?: string,
  severity?: string,
  nodeAddress?: string
): Promise<Alert[]> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (severity) params.append('severity', severity);
  if (nodeAddress) params.append('node_address', nodeAddress);
  
  const response = await fetch(`${apiUrl}/v1/alerts?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch alerts');
  return response.json();
}

export async function acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
  const response = await fetch(`${apiUrl}/v1/alerts/${alertId}/acknowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acknowledged_by: acknowledgedBy })
  });
  if (!response.ok) throw new Error('Failed to acknowledge alert');
}

export async function resolveAlert(alertId: string): Promise<void> {
  const response = await fetch(`${apiUrl}/v1/alerts/${alertId}/resolve`, {
    method: 'POST'
  });
  if (!response.ok) throw new Error('Failed to resolve alert');
}
```

### Step 5.3: Create Alert Panel Component

Create `frontend/src/components/alerts/AlertPanel.tsx`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { getAlerts, acknowledgeAlert, Alert } from '../../services/alertService';

export function AlertPanel() {
  const { data: alerts, refetch } = useQuery<Alert[]>({
    queryKey: ['alerts', 'active'],
    queryFn: () => getAlerts('active'),
    refetchInterval: 30000
  });

  const handleAcknowledge = async (alertId: string) => {
    await acknowledgeAlert(alertId, 'user');
    refetch();
  };

  if (!alerts || alerts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Active Alerts</h2>
        <p className="text-gray-500">No active alerts</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">
          Active Alerts ({alerts.length})
        </h2>
      </div>
      
      <div className="space-y-3">
        {alerts.map(alert => (
          <div
            key={alert.id}
            className={`border-l-4 p-4 rounded ${
              alert.severity === 'critical'
                ? 'border-red-500 bg-red-50'
                : alert.severity === 'warning'
                ? 'border-yellow-500 bg-yellow-50'
                : 'border-blue-500 bg-blue-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    alert.severity === 'critical'
                      ? 'bg-red-500 text-white'
                      : alert.severity === 'warning'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-blue-500 text-white'
                  }`}>
                    {alert.severity.toUpperCase()}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {alert.node_address ? `Node: ${alert.node_address.slice(0, 20)}...` : 'Network'}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-1">{alert.message}</p>
                <p className="text-xs text-gray-500">
                  {new Date(alert.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => handleAcknowledge(alert.id)}
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Acknowledge
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Step 5.4: Create Metrics Chart Component

Create `frontend/src/components/charts/TimeSeriesChart.tsx`:

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DataPoint {
  time: string;
  value: number;
  [key: string]: any;
}

interface TimeSeriesChartProps {
  data: DataPoint[];
  metric: string;
  showThreshold?: boolean;
  thresholdValue?: number;
}

export function TimeSeriesChart({ data, metric, showThreshold, thresholdValue }: TimeSeriesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="time" 
          tickFormatter={(value) => new Date(value).toLocaleTimeString()}
        />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="value" 
          stroke="#3B82F6" 
          strokeWidth={2}
          name={metric}
        />
        {showThreshold && thresholdValue && (
          <Line
            type="monotone"
            dataKey={() => thresholdValue}
            stroke="#EF4444"
            strokeDasharray="5 5"
            name="Threshold"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
```

## Next Steps

1. **Complete Pattern Detection**: Implement historical data fetching for pattern-based alerts
2. **Add Alert Rules UI**: Create forms for managing alert rules
3. **Implement Notifications**: Add email/webhook notification dispatch
4. **Add More Visualizations**: Network comparison charts, heatmaps
5. **Performance Optimization**: Add caching, optimize database queries
6. **Testing**: Write unit and integration tests

This implementation guide provides a solid foundation. Continue building out features incrementally based on the design document.
