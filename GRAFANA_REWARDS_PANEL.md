# Adding Rewards Panel to Grafana Dashboard

## Quick Method: Add Panel to Existing Dashboard

### Option 1: Add Panel via Grafana UI

1. **Open your dashboard** in Grafana (e.g., "Gonka Network Overview")
2. **Click "Add"** → **"Visualization"** (or click "Edit" on the dashboard)
3. **Select "Time series"** panel type
4. **Configure the query:**

   **Data source:** PostgreSQL
   
   **Query:**
   ```sql
   SELECT
     time AS "time",
     node_address AS metric,
     earned_coins AS "Earned Coins"
   FROM node_metrics
   WHERE $__timeFilter(time)
   ORDER BY time
   ```

5. **Customize:**
   - **Title:** "Earned Coins Over Time"
   - **Legend:** Show as table with calculations (last, max, sum)
   - **Unit:** Short (for numbers)

6. **Save** the panel

### Option 2: Add Panel via JSON (Advanced)

1. **Edit dashboard** → Click the **⋮ menu** → **"JSON Model"**
2. **Find the `panels` array**
3. **Add this panel configuration:**

```json
{
  "id": 7,
  "gridPos": {
    "h": 8,
    "w": 12,
    "x": 0,
    "y": 24
  },
  "type": "timeseries",
  "title": "Earned Coins Over Time",
  "targets": [
    {
      "datasource": {
        "type": "postgres",
        "uid": "PostgreSQL"
      },
      "editorMode": "code",
      "format": "table",
      "rawQuery": true,
      "rawSql": "SELECT\n  time AS \"time\",\n  node_address AS metric,\n  earned_coins AS \"Earned Coins\"\nFROM node_metrics\nWHERE $__timeFilter(time)\nORDER BY time",
      "refId": "A"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "color": {
        "mode": "palette-classic"
      },
      "custom": {
        "drawStyle": "line",
        "lineInterpolation": "linear",
        "lineWidth": 1,
        "fillOpacity": 10,
        "gradientMode": "none",
        "spanNulls": false,
        "showPoints": "never"
      },
      "unit": "short"
    }
  },
  "options": {
    "legend": {
      "calcs": ["lastNotNull", "max", "sum"],
      "displayMode": "table",
      "placement": "bottom"
    },
    "tooltip": {
      "mode": "multi"
    }
  }
}
```

4. **Adjust `gridPos`** values to position it correctly
5. **Save** the dashboard

## SQL Queries for Different Reward Metrics

### 1. Earned Coins Over Time
```sql
SELECT
  time AS "time",
  node_address AS metric,
  earned_coins AS "Earned Coins"
FROM node_metrics
WHERE $__timeFilter(time)
ORDER BY time
```

### 2. Rewarded Coins Over Time
```sql
SELECT
  time AS "time",
  node_address AS metric,
  rewarded_coins AS "Rewarded Coins"
FROM node_metrics
WHERE $__timeFilter(time)
ORDER BY time
```

### 3. Reward Rate (Rewarded / Earned) Percentage
```sql
SELECT
  time AS "time",
  node_address AS metric,
  CASE 
    WHEN earned_coins > 0 THEN (rewarded_coins::numeric / earned_coins::numeric) * 100
    ELSE 0
  END AS "Reward Rate %"
FROM node_metrics
WHERE $__timeFilter(time)
  AND earned_coins > 0
ORDER BY time
```

### 4. Total Rewards Summary Table
```sql
SELECT
  node_address AS "Participant",
  MAX(earned_coins) AS "Total Earned",
  MAX(rewarded_coins) AS "Total Rewarded",
  CASE 
    WHEN MAX(earned_coins) > 0 THEN ROUND((MAX(rewarded_coins)::numeric / MAX(earned_coins)::numeric) * 100, 2)
    ELSE 0
  END AS "Reward Rate %",
  COUNT(*) AS "Data Points"
FROM node_metrics
WHERE $__timeFilter(time)
GROUP BY node_address
ORDER BY "Total Rewarded" DESC
```

### 5. Filtered by Specific Participant
```sql
SELECT
  time AS "time",
  earned_coins AS "Earned Coins",
  rewarded_coins AS "Rewarded Coins"
FROM node_metrics
WHERE $__timeFilter(time)
  AND node_address = 'gonka1abc123...'
ORDER BY time
```

### 6. Cumulative Rewards Over Time
```sql
SELECT
  time AS "time",
  node_address AS metric,
  SUM(earned_coins) OVER (PARTITION BY node_address ORDER BY time) AS "Cumulative Earned",
  SUM(rewarded_coins) OVER (PARTITION BY node_address ORDER BY time) AS "Cumulative Rewarded"
FROM node_metrics
WHERE $__timeFilter(time)
ORDER BY time
```

## Using the Standalone Rewards Dashboard

A complete rewards dashboard has been created at:
`grafana/dashboards/gonka-rewards-panel.json`

This dashboard includes:
- Earned Coins Over Time (time series)
- Rewarded Coins Over Time (time series)
- Reward Rate Percentage (time series)
- Total Rewards Summary Table

**To use it:**
1. The dashboard will auto-load if Grafana provisioning is configured
2. Or manually import: **Dashboards** → **Import** → Upload the JSON file

## Panel Configuration Tips

### For Time Series Panels:
- **Unit:** Use "short" for coin amounts, "percent" for rates
- **Legend:** Enable table mode with calculations (last, max, sum, avg)
- **Tooltip:** Set to "multi" to see all series at once
- **Line interpolation:** "linear" for smooth lines, "stepBefore" for step charts

### For Table Panels:
- **Cell height:** "sm" for compact view
- **Sort:** Click column headers to sort
- **Format:** Numbers auto-format based on unit

### Filtering by Participant:
If you have a participant variable defined, use:
```sql
WHERE $__timeFilter(time)
  AND ('$participant' = '$__all' OR node_address = '$participant')
```

## Troubleshooting

**No data showing?**
- Check if metrics collector is running and writing data
- Verify time range covers when data was collected
- Check if `earned_coins` and `rewarded_coins` have values (not all NULL)

**Panel shows errors?**
- Verify PostgreSQL data source is configured correctly
- Check SQL syntax (especially if using CASE statements)
- Ensure table name is `node_metrics` (not `node_metric`)

**Want to filter by specific participants?**
- Use the participant variable dropdown (if configured)
- Or modify SQL to add: `AND node_address IN ('addr1', 'addr2')`
