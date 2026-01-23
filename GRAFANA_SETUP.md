# Grafana Setup Guide for Gonka Tracker

Using Grafana is an excellent choice! It provides professional monitoring dashboards, alerting, and time-series visualizations out of the box, saving significant development time.

## Benefits of Using Grafana

✅ **Professional UI** - Battle-tested, polished interface  
✅ **Built-in Alerting** - Email, Slack, webhooks, PagerDuty support  
✅ **Time-Series Optimized** - Designed for monitoring data  
✅ **Rich Visualizations** - Charts, graphs, heatmaps, stat panels  
✅ **Dashboard Sharing** - Export/import dashboards as JSON  
✅ **User Management** - Authentication, roles, permissions  
✅ **Plugin Ecosystem** - Extensible with plugins  
✅ **Fast Setup** - Get monitoring in minutes, not weeks  

## Architecture

```
┌─────────────┐
│   Backend   │ → Collects metrics → PostgreSQL/TimescaleDB
│  (FastAPI)  │
└─────────────┘
       ↓
┌─────────────┐
│ PostgreSQL  │ ← Grafana reads from here
│ TimescaleDB │
└─────────────┘
       ↓
┌─────────────┐
│   Grafana   │ → Visualizes & Alerts
└─────────────┘
```

## Setup Steps

### Step 1: Add PostgreSQL + Grafana to Docker Compose

Update your `docker-compose.yaml`:

```yaml
services:
  # ... existing services (traefik, backend, frontend) ...

  postgres:
    image: timescale/timescaledb:latest-pg15
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: ${POSTGRES_DB:-gonka_tracker}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_USER: ${GRAFANA_ADMIN_USER:-admin}
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-admin}
      GF_SERVER_ROOT_URL: http://localhost/grafana
      GF_SERVER_SERVE_FROM_SUB_PATH: true
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/var/lib/grafana/dashboards
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.grafana.rule=PathPrefix(`/grafana`)"
      - "traefik.http.routers.grafana.entrypoints=web,websecure"
      - "traefik.http.services.grafana.loadbalancer.server.port=3000"
      - "traefik.http.middlewares.grafana-strip.stripprefix.prefixes=/grafana"
      - "traefik.http.routers.grafana.middlewares=grafana-strip"
    depends_on:
      - postgres
    restart: unless-stopped

volumes:
  backend-cache:
  postgres-data:
  grafana-data:
```

### Step 2: Update config.env

Add these to your `config.env`:

```bash
# PostgreSQL Configuration
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=gonka_tracker

# Grafana Configuration
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin
```

### Step 3: Create Grafana Provisioning Directories

```bash
mkdir -p grafana/provisioning/datasources
mkdir -p grafana/provisioning/dashboards
mkdir -p grafana/dashboards
```

### Step 4: Configure PostgreSQL Data Source

Create `grafana/provisioning/datasources/postgres.yml`:

```yaml
apiVersion: 1

datasources:
  - name: PostgreSQL
    type: postgres
    access: proxy
    url: postgres:5432
    database: gonka_tracker
    user: postgres
    secureJsonData:
      password: postgres
    jsonData:
      sslmode: disable
      timescaledb: true
      postgresVersion: 1500
      maxOpenConns: 100
      maxIdleConns: 100
      connMaxLifetime: 14400
    isDefault: true
    editable: true
```

### Step 5: Configure Dashboard Provisioning

Create `grafana/provisioning/dashboards/default.yml`:

```yaml
apiVersion: 1

providers:
  - name: 'Gonka Tracker'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
```

### Step 6: Create Database Schema

The backend will create the tables, but you can also run this SQL manually:

```sql
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

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

-- Network metrics table
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_node_metrics_address ON node_metrics(node_address);
CREATE INDEX IF NOT EXISTS idx_node_metrics_epoch ON node_metrics(epoch_id);
CREATE INDEX IF NOT EXISTS idx_network_metrics_epoch ON network_metrics(epoch_id);
```

### Step 7: Start Services

```bash
docker-compose up -d postgres grafana
```

Wait for services to be healthy, then access Grafana at:
- **URL**: `http://localhost/grafana`
- **Username**: `admin` (or your GRAFANA_ADMIN_USER)
- **Password**: `admin` (or your GRAFANA_ADMIN_PASSWORD)

## Example Dashboard Queries

### Network Overview Panel

**Total Nodes Over Time:**
```sql
SELECT
  time AS "time",
  total_nodes AS "Total Nodes"
FROM network_metrics
WHERE $__timeFilter(time)
ORDER BY time
```

**Average Missed Rate:**
```sql
SELECT
  time AS "time",
  avg_missed_rate * 100 AS "Missed Rate %"
FROM network_metrics
WHERE $__timeFilter(time)
ORDER BY time
```

**Total Inferences:**
```sql
SELECT
  time AS "time",
  total_inferences AS "Total Inferences"
FROM network_metrics
WHERE $__timeFilter(time)
ORDER BY time
```

### Node-Specific Panels

**Missed Rate by Node:**
```sql
SELECT
  time AS "time",
  node_address AS metric,
  missed_rate * 100 AS "Missed Rate %"
FROM node_metrics
WHERE $__timeFilter(time)
  AND node_address IN ($node_address)
ORDER BY time
```

**Inference Count by Node:**
```sql
SELECT
  time AS "time",
  node_address AS metric,
  inference_count AS "Inferences"
FROM node_metrics
WHERE $__timeFilter(time)
  AND node_address IN ($node_address)
ORDER BY time
```

**Node Health Status:**
```sql
SELECT
  time AS "time",
  node_address AS metric,
  CASE WHEN node_healthy THEN 1 ELSE 0 END AS "Healthy"
FROM node_metrics
WHERE $__timeFilter(time)
  AND node_address IN ($node_address)
ORDER BY time
```

### Comparison Queries

**Top 5 Nodes by Inference Count:**
```sql
SELECT
  node_address,
  SUM(inference_count) AS total_inferences
FROM node_metrics
WHERE $__timeFilter(time)
GROUP BY node_address
ORDER BY total_inferences DESC
LIMIT 5
```

**Nodes with Highest Missed Rate:**
```sql
SELECT
  node_address,
  AVG(missed_rate) * 100 AS avg_missed_rate
FROM node_metrics
WHERE $__timeFilter(time)
GROUP BY node_address
HAVING AVG(missed_rate) > 0.05
ORDER BY avg_missed_rate DESC
```

## Grafana Alert Rules

### Example 1: High Missed Rate Alert

**Alert Rule Configuration:**
- **Name**: High Missed Rate
- **Query**: 
  ```sql
  SELECT
    time,
    node_address,
    missed_rate * 100 AS value
  FROM node_metrics
  WHERE $__timeFilter(time)
  ```
- **Condition**: `WHEN value IS ABOVE 10` (10%)
- **Evaluation**: Every 30s, for 5 minutes
- **Notification**: Email/Slack/Webhook

### Example 2: Node Health Check Failure

**Alert Rule Configuration:**
- **Name**: Node Health Check Failed
- **Query**:
  ```sql
  SELECT
    time,
    node_address,
    CASE WHEN node_healthy THEN 0 ELSE 1 END AS value
  FROM node_metrics
  WHERE $__timeFilter(time)
  ```
- **Condition**: `WHEN value IS EQUAL TO 1`
- **Evaluation**: Every 30s, for 2 minutes
- **Notification**: Critical alert

### Example 3: Network-Wide Anomaly

**Alert Rule Configuration:**
- **Name**: Network Average Missed Rate High
- **Query**:
  ```sql
  SELECT
    time,
    avg_missed_rate * 100 AS value
  FROM network_metrics
  WHERE $__timeFilter(time)
  ```
- **Condition**: `WHEN value IS ABOVE 5` (5%)
- **Evaluation**: Every 1 minute, for 10 minutes
- **Notification**: Warning alert

## Notification Channels

### Email Notification

1. Go to **Alerting → Notification channels**
2. Click **Add channel**
3. Configure:
   - **Name**: Email Alerts
   - **Type**: Email
   - **Addresses**: your-email@example.com
   - **Send on all alerts**: Yes

### Slack Notification

1. Create a Slack webhook URL
2. Go to **Alerting → Notification channels**
3. Click **Add channel**
4. Configure:
   - **Name**: Slack Alerts
   - **Type**: Slack
   - **Webhook URL**: `https://hooks.slack.com/services/YOUR/WEBHOOK/URL`
   - **Channel**: `#alerts`

### Webhook Notification

1. Go to **Alerting → Notification channels**
2. Click **Add channel**
3. Configure:
   - **Name**: Webhook Alerts
   - **Type**: Webhook
   - **URL**: `https://your-api.com/webhook`
   - **HTTP Method**: POST

## Dashboard JSON Export

You can export dashboards as JSON and version control them. Example structure:

```json
{
  "dashboard": {
    "title": "Gonka Tracker - Network Overview",
    "tags": ["gonka", "monitoring"],
    "timezone": "browser",
    "panels": [
      {
        "title": "Total Nodes",
        "type": "graph",
        "targets": [
          {
            "expr": "SELECT time, total_nodes FROM network_metrics WHERE $__timeFilter(time)"
          }
        ]
      }
    ]
  }
}
```

## Integration with Backend

The backend needs to write metrics to PostgreSQL. Use the `MetricsCollector` from the implementation guide, or create a simple service:

```python
# backend/src/backend/grafana_metrics.py
import asyncpg
from datetime import datetime
from backend.models import InferenceResponse

class GrafanaMetricsWriter:
    def __init__(self, db_pool: asyncpg.Pool):
        self.db_pool = db_pool
    
    async def write_node_metrics(self, inference_data: InferenceResponse):
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
```

## Quick Start Checklist

- [ ] Add PostgreSQL and Grafana to docker-compose.yaml
- [ ] Create Grafana provisioning directories
- [ ] Configure PostgreSQL data source
- [ ] Create database schema (or let backend create it)
- [ ] Start services: `docker-compose up -d postgres grafana`
- [ ] Access Grafana at `http://localhost/grafana`
- [ ] Create first dashboard with network metrics
- [ ] Set up alert rules
- [ ] Configure notification channels
- [ ] Export dashboard JSON for version control

## Advantages Over Custom Dashboard

| Feature | Grafana | Custom Dashboard |
|--------|---------|------------------|
| **Development Time** | Hours | Weeks |
| **Alerting** | Built-in | Need to build |
| **Visualizations** | 30+ panel types | Need to build |
| **User Management** | Built-in | Need to build |
| **Dashboard Sharing** | JSON export/import | Need to build |
| **Performance** | Optimized for TSDB | Need to optimize |
| **Maintenance** | Community maintained | You maintain |
| **Cost** | Free (OSS) | Development time |

## Hybrid Approach

You can use **both**:
- **Grafana** for monitoring, alerts, and time-series analysis
- **Custom Frontend** for the participant table, epoch selector, and other custom UI

They can share the same PostgreSQL database!

## Next Steps

1. Set up Grafana using the steps above
2. Create your first dashboard
3. Set up alert rules
4. Configure notifications
5. Export dashboards as JSON and commit to repo

Grafana will give you professional monitoring capabilities immediately, while you can still enhance the custom frontend for specific use cases.
