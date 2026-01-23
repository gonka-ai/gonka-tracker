# Gonka Block Progression Dashboard

## Overview

A Grafana dashboard for visualizing block progression, similar to `http://node2.gonka.ai:8000/dashboard/gonka/block`. This dashboard shows:

- Block height progression over time
- Current block height and epoch
- Block rate (blocks per minute)
- Epoch progression
- Block height changes
- Epoch statistics

## Dashboard Panels

### 1. Block Height Over Time
- **Type**: Time series line chart
- **Shows**: Block height progression over the selected time range
- **Data**: `network_metrics.block_height` over time

### 2. Current Block Height
- **Type**: Stat panel
- **Shows**: The latest block height
- **Updates**: Real-time (refreshes every 10 seconds)

### 3. Current Epoch
- **Type**: Stat panel
- **Shows**: The current epoch ID
- **Updates**: Real-time

### 4. Block Rate (Blocks per Minute)
- **Type**: Time series bar chart
- **Shows**: Average blocks per minute calculated over 1-minute intervals
- **Calculation**: `(max_height - min_height) / time_delta * 60`

### 5. Block Height Change Rate
- **Type**: Time series line chart
- **Shows**: Change in block height between consecutive measurements
- **Use**: Identifies when blocks are being produced vs. when the chain is idle

### 6. Epoch Progression
- **Type**: Time series step chart
- **Shows**: Epoch transitions over time
- **Visualization**: Step chart to clearly show epoch boundaries

### 7. Block Height by Epoch
- **Type**: Table
- **Shows**: 
  - Start and end block heights for each epoch
  - Number of blocks in each epoch
  - Epoch start and end times
- **Sorted**: By epoch ID (newest first)

### 8. Average Block Rate
- **Type**: Stat panel
- **Shows**: Overall average blocks per minute for the selected time range

## Data Source

The dashboard uses the `network_metrics` table in PostgreSQL, which is populated by the `collect_metrics.py` script. This table contains:
- `time`: Timestamp
- `epoch_id`: Current epoch
- `block_height`: Block height at that time

## Installation

The dashboard is automatically provisioned by Grafana. It should appear in Grafana's dashboard list within 10-20 seconds after:
1. The file is placed in `grafana/dashboards/gonka-block-progression.json`
2. Grafana is restarted or the provisioning directory is scanned

### Manual Import (if needed)

1. Open Grafana: `http://localhost/grafana`
2. Go to **Dashboards** → **Import**
3. Upload `grafana/dashboards/gonka-block-progression.json`
4. Select the PostgreSQL data source
5. Click **Import**

## Accessing the Dashboard

Once imported, access the dashboard at:
- Grafana UI: Navigate to **Dashboards** → **Gonka Block Progression**
- Direct URL: `http://localhost/grafana/d/gonka-blocks/gonka-block-progression`

## Dashboard Settings

- **Refresh Rate**: 10 seconds (auto-refresh)
- **Time Range**: Defaults to "Last 6 hours" (configurable)
- **Timezone**: Browser timezone

## Customization

### Adjust Time Range
- Use the time picker in the top-right corner
- Select predefined ranges (Last 1 hour, Last 6 hours, etc.)
- Or set a custom range

### Modify Queries
Each panel's SQL query can be edited directly in Grafana:
1. Click the panel title → **Edit**
2. Scroll to the query section
3. Modify the SQL as needed

### Add More Panels
You can add additional panels to show:
- Block time intervals (if timestamp data is available)
- Blocks per epoch comparison
- Network sync status
- Validator participation

## Troubleshooting

### No Data Showing
1. **Check data collection**: Verify `collect_metrics.py` is running
   ```bash
   # Check if data exists
   docker-compose exec postgres psql -U postgres -d gonka_tracker -c "SELECT COUNT(*) FROM network_metrics;"
   ```

2. **Check time range**: Ensure your selected time range includes data
   - Try "Last 1 hour" or "Last 6 hours"

3. **Check data source**: Verify PostgreSQL data source is configured correctly
   - Go to **Configuration** → **Data Sources** → **PostgreSQL**

### SQL Errors
If you see SQL errors:
- Ensure TimescaleDB extension is enabled
- Check that `time_bucket` function is available (TimescaleDB function)
- Verify table structure matches expected schema

## Related Dashboards

- **Network Overview**: `gonka-network-overview.json` - Network-wide statistics
- **Node Details**: `gonka-node-details.json` - Per-node metrics
- **Rewards**: `gonka-rewards-panel.json` - Participant rewards over time

## Notes

- Block height data is collected every 30 seconds (default `COLLECT_INTERVAL`)
- The dashboard uses TimescaleDB's `time_bucket` function for time-based aggregations
- Block rate calculations may show 0 during periods when the chain is not producing blocks
