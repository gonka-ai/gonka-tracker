# Network Monitoring Dashboard Design with Alerts

## Overview

This document outlines the design for a comprehensive network monitoring dashboard that allows monitoring multiple Gonka Chain nodes, visualizing statistics, and alerting on pattern deviations.

## Architecture

### Components

1. **Backend Enhancements**
   - Alert engine with pattern detection
   - Historical data aggregation
   - Alert configuration API
   - Webhook/notification system

2. **Frontend Dashboard**
   - Network overview
   - Node monitoring views
   - Time-series visualizations
   - Alert management interface
   - Alert history and notifications

---

## 1. Dashboard Layout

### 1.1 Main Dashboard View

```
┌─────────────────────────────────────────────────────────────────┐
│  Header: Network Monitor | Alerts (3) | Settings | User        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Network Overview Cards                                   │ │
│  │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐            │ │
│  │ │Nodes │ │Total │ │Avg   │ │Active│ │Alerts│            │ │
│  │ │  12  │ │Weight│ │Health│ │  11  │ │  3   │            │ │
│  │ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Active Alerts Panel (Collapsible)                         │ │
│  │ ⚠️  Node-3: Missed rate spike (15% → 25%) [5 min ago]    │ │
│  │ ⚠️  Node-7: Health check failed [2 min ago]               │ │
│  │ ⚠️  Network: Avg invalidation rate above threshold [10m] │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Time-Series Charts (Tabs: Network | Individual Nodes)    │ │
│  │ ┌──────────────────────────────────────────────────────┐ │ │
│  │ │  [Network Metrics Over Time]                        │ │ │
│  │ │  ┌──────────────────────────────────────────────┐   │ │ │
│  │ │  │ Inference Rate (last 24h)                    │   │ │ │
│  │ │  │ [Line Chart: Network avg + Individual nodes] │   │ │ │
│  │ │  └──────────────────────────────────────────────┘   │ │ │
│  │ │  ┌──────────────────────────────────────────────┐   │ │ │
│  │ │  │ Missed Rate (last 24h)                       │   │ │ │
│  │ │  │ [Line Chart with thresholds]                 │   │ │ │
│  │ │  └──────────────────────────────────────────────┘   │ │ │
│  │ │  ┌──────────────────────────────────────────────┐   │ │ │
│  │ │  │ Invalidation Rate (last 24h)                 │   │ │ │
│  │ │  │ [Line Chart with thresholds]                 │   │ │ │
│  │ │  └──────────────────────────────────────────────┘   │ │ │
│  │ └──────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Node Grid View                                            │ │
│  │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐            │ │
│  │ │Node 1│ │Node 2│ │Node 3│ │Node 4│ │Node 5│            │ │
│  │ │🟢 OK │ │🟢 OK │ │🔴 ALERT│ │🟢 OK │ │🟡 WARN│            │ │
│  │ │      │ │      │ │      │ │      │ │      │            │ │
│  │ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘            │ │
│  │ [Click to expand node details]                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Node Detail View

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Network | Node: gonka1abc... (Node-3)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Node Status Card                                          │ │
│  │ Status: 🔴 ALERT | Health: ❌ Unhealthy | Jail: ✅ Active │ │
│  │ Address: gonka1abc123... | Weight: 437 | Models: 3       │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Current Metrics                                           │ │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │ │
│  │ │Inferences│ │Missed    │ │Validated │ │Invalidated│     │ │
│  │ │  1,234   │ │   156    │ │  1,100   │ │    34     │     │ │
│  │ │          │ │ (12.6%)  │ │          │ │  (2.8%)   │     │ │
│  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Node Metrics Over Time (Tabs: 1h | 6h | 24h | 7d | 30d) │ │
│  │ [Multiple line charts: inferences, missed rate,          │ │
│  │  invalidation rate, health status, weight changes]       │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Active Alerts for This Node                              │ │
│  │ • Missed rate exceeded threshold (15% > 10%)             │ │
│  │ • Health check failed 3 times in last 10 minutes          │ │
│  │ • Pattern deviation: Inference rate dropped 30%          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Alert History (Last 30 days)                             │ │
│  │ [Timeline view of all alerts for this node]              │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Alert System Design

### 2.1 Alert Types

#### A. Threshold-Based Alerts
- **Missed Rate Alert**: Triggered when missed rate exceeds configured threshold
- **Invalidation Rate Alert**: Triggered when invalidation rate exceeds threshold
- **Health Check Alert**: Triggered when node health check fails
- **Jail Status Alert**: Triggered when node gets jailed
- **Weight Drop Alert**: Triggered when node weight drops significantly
- **Inference Rate Drop Alert**: Triggered when inference rate drops below threshold

#### B. Pattern Deviation Alerts
- **Statistical Anomaly Detection**: 
  - Z-score based detection (e.g., value > 2σ from mean)
  - Moving average deviation
  - Rate of change detection
  
- **Pattern Matching**:
  - Sudden spike/drop detection
  - Trend reversal detection
  - Seasonal pattern deviation (if applicable)

#### C. Comparative Alerts
- **Network Average Deviation**: Node deviates significantly from network average
- **Peer Comparison**: Node performance significantly worse than similar nodes
- **Historical Comparison**: Current performance deviates from historical baseline

### 2.2 Alert Configuration

```typescript
interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: 'threshold' | 'pattern' | 'comparative';
  
  // Target
  target: 'node' | 'network' | 'all_nodes';
  node_address?: string; // If target is 'node'
  
  // Condition
  metric: 'missed_rate' | 'invalidation_rate' | 'inference_count' | 
          'health_status' | 'jail_status' | 'weight' | 'earned_coins';
  
  // Threshold-based
  threshold?: {
    operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
    value: number;
    duration?: number; // Alert only if condition persists for X minutes
  };
  
  // Pattern-based
  pattern?: {
    method: 'z_score' | 'moving_avg' | 'rate_of_change';
    window: number; // Time window in minutes
    sensitivity: number; // Sensitivity level (1-10)
    baseline?: 'network_avg' | 'historical' | 'peer_avg';
  };
  
  // Comparative
  comparative?: {
    compare_to: 'network_avg' | 'peer_avg' | 'historical';
    deviation_percent: number; // Alert if deviates by X%
    window: number;
  };
  
  // Notification
  notification: {
    channels: ('dashboard' | 'email' | 'webhook' | 'slack')[];
    webhook_url?: string;
    email?: string;
    severity: 'info' | 'warning' | 'critical';
  };
  
  // Cooldown
  cooldown_minutes: number; // Don't re-alert for X minutes after resolution
}
```

### 2.3 Alert Detection Engine

**Backend Service Flow:**

```
1. Data Collection (every 30s)
   ↓
2. Store in time-series database (InfluxDB/PostgreSQL TimescaleDB)
   ↓
3. Alert Engine (runs every 30s)
   ├─ Evaluate threshold rules
   ├─ Evaluate pattern rules (analyze last N data points)
   ├─ Evaluate comparative rules
   └─ Generate alerts if conditions met
   ↓
4. Alert Management
   ├─ Check cooldown periods
   ├─ Update existing alerts (if still active)
   ├─ Create new alerts
   └─ Resolve alerts (if condition no longer met)
   ↓
5. Notification Dispatch
   ├─ Dashboard notification
   ├─ Email (if configured)
   ├─ Webhook (if configured)
   └─ Slack (if configured)
```

### 2.4 Pattern Detection Algorithms

#### Z-Score Detection
```python
def detect_z_score_anomaly(values: List[float], threshold: float = 2.0) -> bool:
    if len(values) < 10:
        return False
    
    mean = sum(values) / len(values)
    std = (sum((x - mean) ** 2 for x in values) / len(values)) ** 0.5
    
    if std == 0:
        return False
    
    latest = values[-1]
    z_score = abs((latest - mean) / std)
    
    return z_score > threshold
```

#### Moving Average Deviation
```python
def detect_moving_avg_deviation(values: List[float], window: int = 20, threshold_percent: float = 20) -> bool:
    if len(values) < window + 1:
        return False
    
    recent = values[-window:]
    ma = sum(recent) / len(recent)
    current = values[-1]
    
    deviation = abs((current - ma) / ma) * 100 if ma > 0 else 0
    
    return deviation > threshold_percent
```

#### Rate of Change Detection
```python
def detect_rate_of_change(values: List[float], threshold_percent: float = 30) -> bool:
    if len(values) < 2:
        return False
    
    previous = values[-2]
    current = values[-1]
    
    if previous == 0:
        return False
    
    change_percent = abs((current - previous) / previous) * 100
    
    return change_percent > threshold_percent
```

---

## 3. Data Storage & Aggregation

### 3.1 Time-Series Data Structure

```sql
-- Node metrics table (PostgreSQL with TimescaleDB extension)
CREATE TABLE node_metrics (
    time TIMESTAMPTZ NOT NULL,
    node_address TEXT NOT NULL,
    epoch_id INTEGER,
    block_height INTEGER,
    
    -- Metrics
    inference_count BIGINT,
    missed_requests BIGINT,
    validated_inferences BIGINT,
    invalidated_inferences BIGINT,
    earned_coins BIGINT,
    rewarded_coins BIGINT,
    weight INTEGER,
    
    -- Computed rates
    missed_rate DECIMAL(5,4),
    invalidation_rate DECIMAL(5,4),
    
    -- Status
    is_jailed BOOLEAN,
    node_healthy BOOLEAN,
    
    PRIMARY KEY (time, node_address)
);

-- Create hypertable for time-series optimization
SELECT create_hypertable('node_metrics', 'time');

-- Network aggregate metrics
CREATE TABLE network_metrics (
    time TIMESTAMPTZ NOT NULL,
    epoch_id INTEGER,
    block_height INTEGER,
    
    -- Aggregates
    total_nodes INTEGER,
    active_nodes INTEGER,
    total_weight BIGINT,
    total_inferences BIGINT,
    total_missed BIGINT,
    avg_missed_rate DECIMAL(5,4),
    avg_invalidation_rate DECIMAL(5,4),
    
    PRIMARY KEY (time)
);

SELECT create_hypertable('network_metrics', 'time');
```

### 3.2 Alert Storage

```sql
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    
    -- Target
    target_type TEXT NOT NULL, -- 'node' | 'network'
    node_address TEXT,
    
    -- Alert details
    metric TEXT NOT NULL,
    current_value DECIMAL,
    threshold_value DECIMAL,
    deviation_percent DECIMAL,
    message TEXT NOT NULL,
    
    -- Status
    status TEXT NOT NULL, -- 'active' | 'resolved' | 'acknowledged'
    created_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by TEXT,
    
    -- Metadata
    metadata JSONB
);

CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_node ON alerts(node_address);
CREATE INDEX idx_alerts_created ON alerts(created_at);
```

---

## 4. API Endpoints

### 4.1 Alert Management

```typescript
// Get all alerts
GET /api/v1/alerts
Query params: ?status=active&severity=critical&node_address=...

// Get alert by ID
GET /api/v1/alerts/{alert_id}

// Acknowledge alert
POST /api/v1/alerts/{alert_id}/acknowledge
Body: { acknowledged_by: "user@example.com" }

// Resolve alert (manual)
POST /api/v1/alerts/{alert_id}/resolve

// Get alert history
GET /api/v1/alerts/history
Query params: ?node_address=...&start_date=...&end_date=...
```

### 4.2 Alert Rules

```typescript
// List all alert rules
GET /api/v1/alert-rules

// Get alert rule
GET /api/v1/alert-rules/{rule_id}

// Create alert rule
POST /api/v1/alert-rules
Body: AlertRule

// Update alert rule
PUT /api/v1/alert-rules/{rule_id}
Body: AlertRule

// Delete alert rule
DELETE /api/v1/alert-rules/{rule_id}

// Enable/disable rule
POST /api/v1/alert-rules/{rule_id}/toggle
Body: { enabled: true }
```

### 4.3 Time-Series Data

```typescript
// Get node metrics over time
GET /api/v1/metrics/node/{node_address}
Query params: ?start_time=...&end_time=...&interval=1h

// Get network metrics over time
GET /api/v1/metrics/network
Query params: ?start_time=...&end_time=...&interval=1h

// Get aggregated metrics
GET /api/v1/metrics/aggregate
Query params: ?metric=missed_rate&window=24h&group_by=node
```

---

## 5. Frontend Components

### 5.1 Component Structure

```
src/
├── components/
│   ├── network/
│   │   ├── NetworkOverview.tsx
│   │   ├── NetworkMetricsChart.tsx
│   │   └── NodeGrid.tsx
│   ├── node/
│   │   ├── NodeCard.tsx
│   │   ├── NodeDetail.tsx
│   │   ├── NodeMetricsChart.tsx
│   │   └── NodeStatusBadge.tsx
│   ├── alerts/
│   │   ├── AlertPanel.tsx
│   │   ├── AlertCard.tsx
│   │   ├── AlertHistory.tsx
│   │   ├── AlertRuleEditor.tsx
│   │   └── AlertConfiguration.tsx
│   └── charts/
│       ├── TimeSeriesChart.tsx
│       ├── MultiLineChart.tsx
│       └── MetricComparisonChart.tsx
├── hooks/
│   ├── useAlerts.ts
│   ├── useNodeMetrics.ts
│   ├── useNetworkMetrics.ts
│   └── useAlertRules.ts
└── services/
    ├── alertService.ts
    ├── metricsService.ts
    └── notificationService.ts
```

### 5.2 Key Components

#### AlertPanel Component
```typescript
interface AlertPanelProps {
  alerts: Alert[];
  onAcknowledge: (alertId: string) => void;
  onViewDetails: (alertId: string) => void;
}

// Displays active alerts with severity indicators
// Auto-refreshes every 30s
// Click to view details or acknowledge
```

#### NodeCard Component
```typescript
interface NodeCardProps {
  node: Participant;
  metrics: NodeMetrics[];
  alerts: Alert[];
  onClick: () => void;
}

// Compact card showing:
// - Node status (health, jail)
// - Key metrics (inferences, missed rate)
// - Alert indicator if any active alerts
// - Quick trend indicator (up/down arrow)
```

#### TimeSeriesChart Component
```typescript
interface TimeSeriesChartProps {
  data: MetricDataPoint[];
  metric: string;
  showThreshold?: boolean;
  thresholdValue?: number;
  showBaseline?: boolean;
  baselineData?: MetricDataPoint[];
  timeRange: '1h' | '6h' | '24h' | '7d' | '30d';
}

// Uses Chart.js or Recharts
// Interactive tooltips
// Zoom/pan capabilities
// Threshold lines
// Alert markers
```

---

## 6. Visualization Features

### 6.1 Charts

1. **Network Overview Charts**
   - Total inferences over time (line chart)
   - Average missed rate (line chart with threshold)
   - Average invalidation rate (line chart with threshold)
   - Active nodes count (area chart)
   - Total weight over time (line chart)

2. **Node Comparison Charts**
   - Side-by-side comparison of multiple nodes
   - Heatmap of missed rates across nodes
   - Scatter plot: weight vs performance

3. **Alert Visualization**
   - Timeline view of alerts
   - Alert frequency chart
   - Alert severity distribution

### 6.2 Real-time Updates

- WebSocket connection for real-time metric updates
- Auto-refresh every 30 seconds
- Visual indicators for new data (pulse animation)
- Toast notifications for new critical alerts

---

## 7. Notification System

### 7.1 Notification Channels

1. **Dashboard Notifications**
   - In-app notification center
   - Badge count on alerts icon
   - Toast notifications for critical alerts

2. **Email Notifications**
   - Configurable per alert rule
   - Summary emails (hourly/daily)
   - Critical alert immediate emails

3. **Webhook Notifications**
   - POST to configured URL
   - JSON payload with alert details
   - Retry mechanism for failed deliveries

4. **Slack Integration** (optional)
   - Slack webhook support
   - Formatted messages with severity colors
   - @mentions for critical alerts

### 7.2 Notification Payload

```json
{
  "alert_id": "uuid",
  "rule_id": "rule-123",
  "alert_type": "threshold",
  "severity": "critical",
  "target": {
    "type": "node",
    "node_address": "gonka1abc..."
  },
  "metric": "missed_rate",
  "current_value": 0.25,
  "threshold_value": 0.10,
  "message": "Node missed rate exceeded threshold: 25% > 10%",
  "timestamp": "2026-01-23T10:30:00Z",
  "node_details": {
    "address": "gonka1abc...",
    "moniker": "Node-3",
    "epoch_id": 42
  }
}
```

---

## 8. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up time-series database (PostgreSQL + TimescaleDB)
- [ ] Implement data collection and storage
- [ ] Create basic alert rule API
- [ ] Build alert detection engine (threshold-based only)
- [ ] Create alert storage and management

### Phase 2: Dashboard UI (Week 3-4)
- [ ] Network overview page
- [ ] Node grid view
- [ ] Node detail page
- [ ] Basic time-series charts
- [ ] Alert panel component

### Phase 3: Pattern Detection (Week 5-6)
- [ ] Implement pattern detection algorithms
- [ ] Add pattern-based alert rules
- [ ] Historical baseline calculation
- [ ] Comparative alert rules

### Phase 4: Advanced Features (Week 7-8)
- [ ] Advanced visualizations
- [ ] Alert configuration UI
- [ ] Notification system (email, webhook)
- [ ] Alert history and analytics
- [ ] Performance optimization

### Phase 5: Polish & Testing (Week 9-10)
- [ ] UI/UX improvements
- [ ] Comprehensive testing
- [ ] Documentation
- [ ] Performance tuning
- [ ] Security review

---

## 9. Technology Stack Recommendations

### Backend
- **Database**: PostgreSQL with TimescaleDB extension
- **Time-series**: InfluxDB (alternative, if preferred)
- **Alert Engine**: Python async service
- **API**: FastAPI (existing)
- **WebSockets**: FastAPI WebSocket support for real-time updates

### Frontend
- **Framework**: React + TypeScript (existing)
- **Charts**: Recharts or Chart.js
- **State Management**: TanStack Query (existing) + Zustand for alerts
- **WebSocket Client**: Native WebSocket or socket.io-client
- **UI Components**: Tailwind CSS (existing) + Headless UI for modals

### Monitoring & Notifications
- **Email**: SendGrid, AWS SES, or SMTP
- **Webhooks**: HTTP client with retry logic
- **Slack**: Slack Webhook API

---

## 10. Example Alert Rules

### Example 1: High Missed Rate
```json
{
  "name": "High Missed Rate Alert",
  "type": "threshold",
  "target": "all_nodes",
  "metric": "missed_rate",
  "threshold": {
    "operator": "gt",
    "value": 0.10,
    "duration": 5
  },
  "notification": {
    "channels": ["dashboard", "email"],
    "severity": "warning"
  }
}
```

### Example 2: Pattern Deviation - Inference Drop
```json
{
  "name": "Inference Rate Drop",
  "type": "pattern",
  "target": "all_nodes",
  "metric": "inference_count",
  "pattern": {
    "method": "rate_of_change",
    "window": 60,
    "sensitivity": 7,
    "baseline": "historical"
  },
  "notification": {
    "channels": ["dashboard", "webhook"],
    "severity": "critical"
  }
}
```

### Example 3: Network Average Deviation
```json
{
  "name": "Below Network Average",
  "type": "comparative",
  "target": "all_nodes",
  "metric": "missed_rate",
  "comparative": {
    "compare_to": "network_avg",
    "deviation_percent": 50,
    "window": 30
  },
  "notification": {
    "channels": ["dashboard"],
    "severity": "info"
  }
}
```

---

## 11. User Experience Flow

### Monitoring Flow
1. User opens dashboard → sees network overview
2. Notices alert badge → clicks to view alerts
3. Sees node with alert → clicks node card
4. Views node detail → sees metrics and alert details
5. Analyzes time-series chart → identifies pattern
6. Acknowledges alert → marks as reviewed

### Alert Configuration Flow
1. User navigates to Alert Settings
2. Creates new alert rule → fills in form
3. Tests rule → previews what would trigger
4. Saves rule → rule becomes active
5. Receives notification when rule triggers

---

## 12. Security Considerations

- Authentication required for alert configuration
- Role-based access control (admin vs viewer)
- Webhook URL validation
- Rate limiting on alert API
- Input validation on all alert rules
- SQL injection prevention
- XSS prevention in alert messages

---

## 13. Performance Considerations

- Time-series data aggregation at database level
- Caching of frequently accessed metrics
- Pagination for alert history
- Lazy loading of charts
- WebSocket connection pooling
- Alert evaluation batching
- Database indexing strategy

---

This design provides a comprehensive foundation for building a network monitoring dashboard with sophisticated alerting capabilities. The system is designed to be scalable, maintainable, and user-friendly.
