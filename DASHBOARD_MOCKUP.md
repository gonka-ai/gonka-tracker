# Dashboard Visual Mockup Specifications

## Color Scheme

- **Primary**: Gray-900 (#111827) - Headers, buttons
- **Success/Healthy**: Green-500 (#10B981) - Healthy nodes, resolved alerts
- **Warning**: Yellow-500 (#F59E0B) - Warnings, degraded performance
- **Critical/Alert**: Red-500 (#EF4444) - Critical alerts, unhealthy nodes
- **Info**: Blue-500 (#3B82F6) - Information, active alerts
- **Background**: Gray-50 (#F9FAFB) - Page background
- **Card Background**: White (#FFFFFF) - Card backgrounds
- **Border**: Gray-200 (#E5E7EB) - Borders

## Component Specifications

### 1. Network Overview Cards

```
┌─────────────────────────────────────────────────────────────┐
│  Network Overview                                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Total Nodes │  │ Active Nodes│  │ Avg Health  │        │
│  │             │  │             │  │             │        │
│  │     12      │  │     11      │  │    95.2%    │        │
│  │             │  │             │  │             │        │
│  │  🟢 +2      │  │  🟢 +1      │  │  🟢 +2.1%   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Total Weight│  │ Total Inf.  │  │ Active Alerts│       │
│  │             │  │             │  │             │        │
│  │   5,244     │  │  45,231     │  │      3      │        │
│  │             │  │             │  │             │        │
│  │  ~12 H100s  │  │  +1,234/h   │  │  🔴 2 Critical│      │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

**Styling:**
- Card: `bg-white rounded-lg shadow-sm border border-gray-200 p-6`
- Title: `text-2xl font-bold text-gray-900 mb-4`
- Value: `text-4xl font-bold text-gray-900`
- Change indicator: `text-sm text-green-600` (positive) or `text-red-600` (negative)
- Icon: Colored dot (🟢/🟡/🔴) next to change

### 2. Alert Panel

```
┌─────────────────────────────────────────────────────────────┐
│  Active Alerts (3)                          [View All →]   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🔴 CRITICAL                                          │  │
│  │ Node-3: Missed rate spike detected                   │  │
│  │ 15% → 25% (67% increase)                              │  │
│  │ 5 minutes ago • gonka1abc123...                      │  │
│  │ [Acknowledge] [View Details]                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🔴 CRITICAL                                          │  │
│  │ Node-7: Health check failed                           │  │
│  │ 3 consecutive failures in last 10 minutes             │  │
│  │ 2 minutes ago • gonka1def456...                       │  │
│  │ [Acknowledge] [View Details]                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🟡 WARNING                                           │  │
│  │ Network: Average invalidation rate above threshold    │  │
│  │ 3.2% > 2.5% threshold                                 │  │
│  │ 10 minutes ago • Network-wide                         │  │
│  │ [Acknowledge] [View Details]                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Styling:**
- Panel: `bg-white rounded-lg shadow-sm border border-gray-200 p-6`
- Critical alert: `border-l-4 border-red-500 bg-red-50`
- Warning alert: `border-l-4 border-yellow-500 bg-yellow-50`
- Info alert: `border-l-4 border-blue-500 bg-blue-50`
- Severity badge: `px-2 py-1 rounded text-xs font-semibold`
- Timestamp: `text-sm text-gray-500`
- Buttons: `px-4 py-2 rounded-md text-sm font-medium`

### 3. Time-Series Chart

```
┌─────────────────────────────────────────────────────────────┐
│  Network Metrics Over Time              [1h|6h|24h|7d|30d]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Inference Rate (last 24h)                            │  │
│  │                                                       │  │
│  │  50k ┤                                                │  │
│  │  40k ┤         ╱───╲                                  │  │
│  │  30k ┤    ╱───╱     ╲───╲                             │  │
│  │  20k ┤───╱              ╲───╲                         │  │
│  │  10k ┤                      ╲───                        │  │
│  │   0k └───────────────────────────────────────────────  │  │
│  │       00:00  06:00  12:00  18:00  24:00              │  │
│  │                                                       │  │
│  │  Network Avg ───  Node-1 ─ ─ ─  Node-3 ─ · ─        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Missed Rate (last 24h)                               │  │
│  │                                                       │  │
│  │  20% ┤                                                │  │
│  │  15% ┤         ╱───╲                                  │  │
│  │  10% ┤    ╱───╱     ╲───╲  ╱───╲                      │  │
│  │   5% ┤───╱              ╲───╱     ╲───               │  │
│  │   0% └───────────────────────────────────────────────  │  │
│  │       00:00  06:00  12:00  18:00  24:00              │  │
│  │                                                       │  │
│  │  Network Avg ───  Threshold ─ ─ ─                    │  │
│  │  ⚠️ Alert markers at 10:30, 14:15                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Styling:**
- Chart container: `bg-white rounded-lg shadow-sm border border-gray-200 p-6`
- Tab buttons: `px-4 py-2 rounded-md text-sm font-medium`
- Active tab: `bg-gray-900 text-white`
- Inactive tab: `bg-gray-100 text-gray-700 hover:bg-gray-200`
- Chart area: `h-64` or `h-80`
- Legend: `flex items-center gap-4 text-sm`
- Alert markers: Red dot with tooltip

### 4. Node Grid

```
┌─────────────────────────────────────────────────────────────┐
│  Node Status Grid                          [View: Grid|List] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Node-1       │  │ Node-2       │  │ Node-3       │     │
│  │              │  │              │  │              │     │
│  │ 🟢 Healthy   │  │ 🟢 Healthy   │  │ 🔴 Alert     │     │
│  │              │  │              │  │              │     │
│  │ Inf: 3,456   │  │ Inf: 2,890   │  │ Inf: 1,234   │     │
│  │ Miss: 2.1%   │  │ Miss: 1.8%  │  │ Miss: 25.0%  │     │
│  │ Weight: 437  │  │ Weight: 437  │  │ Weight: 437  │     │
│  │              │  │              │  │              │     │
│  │ [View Details]│  │ [View Details]│  │ [View Details]│     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Node-4       │  │ Node-5       │  │ Node-6       │     │
│  │              │  │              │  │              │     │
│  │ 🟢 Healthy   │  │ 🟡 Warning   │  │ 🟢 Healthy   │     │
│  │              │  │              │  │              │     │
│  │ Inf: 4,123   │  │ Inf: 2,567   │  │ Inf: 3,789   │     │
│  │ Miss: 1.5%   │  │ Miss: 8.5%   │  │ Miss: 2.3%   │     │
│  │ Weight: 437  │  │ Weight: 437  │  │ Weight: 437  │     │
│  │              │  │              │  │              │     │
│  │ [View Details]│  │ [View Details]│  │ [View Details]│     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Styling:**
- Grid container: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`
- Node card: `bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer`
- Alert card: `border-2 border-red-500` (if has critical alert)
- Warning card: `border-2 border-yellow-500` (if has warning)
- Status badge: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold`
- Status dot: `w-2 h-2 rounded-full mr-2`
- Metrics: `text-sm text-gray-600`
- View button: `mt-3 w-full px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium`

### 5. Node Detail View

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Network                                          │
│  Node: gonka1abc123... (Node-3)                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Status Overview                                       │  │
│  │                                                       │  │
│  │  Status: 🔴 ALERT    Health: ❌ Unhealthy  Jail: ✅ Active│
│  │  Address: gonka1abc123def456...                       │  │
│  │  Weight: 437 | Models: 3 | Epoch: 42                  │  │
│  │  Moniker: Node-3 | Identity: ABC123                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Current Epoch Metrics                                 │  │
│  │                                                       │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │  │Inferences│ │Missed    │ │Validated │ │Invalidated│ │
│  │  │  1,234   │ │   156    │ │  1,100   │ │    34     │ │
│  │  │          │ │ (12.6%)  │ │          │ │  (2.8%)   │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│  │                                                       │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │  │Earned    │ │Rewarded  │ │Burned    │             │
│  │  │ 45.2 GNK │ │ 42.1 GNK │ │  3.1 GNK │             │
│  │  └──────────┘ └──────────┘ └──────────┘             │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Metrics Over Time          [1h|6h|24h|7d|30d]          │  │
│  │                                                       │  │
│  │  [Chart: Inference Count]                            │  │
│  │  [Chart: Missed Rate with threshold line]            │  │
│  │  [Chart: Invalidation Rate]                          │  │
│  │  [Chart: Health Status (boolean timeline)]           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Active Alerts (2)                                     │  │
│  │                                                       │  │
│  │  • Missed rate exceeded threshold (15% > 10%)        │  │
│  │  • Health check failed 3 times in last 10 minutes    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6. Alert Configuration Modal

```
┌─────────────────────────────────────────────────────────────┐
│  Create Alert Rule                                    [×]    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Rule Name: [High Missed Rate Alert____________]            │
│                                                              │
│  Alert Type: ○ Threshold  ● Pattern  ○ Comparative          │
│                                                              │
│  Target: ● All Nodes  ○ Specific Node  ○ Network           │
│  Node Address: [gonka1abc...] (if specific)                 │
│                                                              │
│  Metric: [Missed Rate ▼]                                    │
│                                                              │
│  Condition:                                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Operator: [Greater Than ▼]                           │  │
│  │ Value: [0.10]                                         │  │
│  │ Duration: [5] minutes (optional)                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Notification:                                               │
│  ☑ Dashboard  ☑ Email  ☐ Webhook  ☐ Slack                  │
│  Email: [admin@example.com]                                │
│  Webhook URL: [https://...]                                │
│                                                              │
│  Severity: ○ Info  ● Warning  ○ Critical                   │
│                                                              │
│  Cooldown: [30] minutes                                     │
│                                                              │
│  [Cancel]  [Test Rule]  [Save Rule]                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Responsive Design

### Mobile (< 640px)
- Single column layout
- Stacked cards
- Collapsible sections
- Bottom navigation for main pages

### Tablet (640px - 1024px)
- 2-column grid for node cards
- Side-by-side charts (if space allows)
- Horizontal navigation

### Desktop (> 1024px)
- 3-4 column grid for node cards
- Full dashboard layout
- Sidebar navigation (optional)

## Animation & Interactions

### Hover Effects
- Cards: `hover:shadow-md transition-shadow`
- Buttons: `hover:bg-gray-800` (dark buttons) or `hover:bg-gray-200` (light buttons)
- Node cards: `hover:border-blue-500` (if clickable)

### Loading States
- Skeleton loaders for cards
- Spinner for charts
- Pulse animation for real-time updates

### Alert Notifications
- Toast notification slide-in from top-right
- Badge pulse animation for unread alerts
- Sound notification (optional, configurable)

## Accessibility

- ARIA labels for all interactive elements
- Keyboard navigation support
- Color contrast ratios meet WCAG AA standards
- Screen reader friendly alerts
- Focus indicators on all interactive elements
