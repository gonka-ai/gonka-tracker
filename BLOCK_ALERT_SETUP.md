# Block Height Growth Alert Setup

## Overview

An alert has been added to the Block Progression dashboard that triggers when block height growth stops. This alert monitors whether blocks are being produced and notifies you if the chain appears to be stalled.

## Alert Configuration

### Alert Details
- **Name**: Block Height Growth Stopped
- **Panel**: Block Height Over Time (Panel ID 1)
- **Frequency**: Checks every 30 seconds
- **For Duration**: 2 minutes (alert must be true for 2 minutes before triggering)
- **Condition**: Block height hasn't increased in the last 5 minutes

### How It Works

The alert query calculates:
```
Height Change = (Max block height in last 1 minute) - (Max block height 4-5 minutes ago)
```

If this value is ≤ 0, it means the block height hasn't increased, and the alert triggers.

### Alert States

- **OK**: Block height is increasing normally
- **Alerting**: Block height hasn't increased for 2+ minutes
- **No Data**: No metrics data available (may indicate collector is down)

## Setting Up Notifications

The alert is configured but needs notification channels set up. To add notifications:

### Option 1: Via Grafana UI

1. Open the dashboard: `http://localhost/grafana/d/gonka-blocks/gonka-block-progression`
2. Click on the **Block Height Over Time** panel title → **Edit**
3. Go to the **Alert** tab
4. Scroll to **Notification channels**
5. Click **+ Add notification channel**
6. Configure your notification channel (Email, Slack, PagerDuty, etc.)
7. Save the panel

### Option 2: Configure Notification Channels First

1. Go to **Alerting** → **Notification channels** (or **Alerting** → **Contact points** in Grafana 9+)
2. Create a new notification channel:
   - **Email**: Configure SMTP settings
   - **Slack**: Add webhook URL
   - **Webhook**: Custom webhook endpoint
   - **PagerDuty**: Integration key
3. Return to the dashboard and add the channel to the alert

### Option 3: Add to Dashboard JSON

You can add notification channel references directly in the dashboard JSON:

```json
"notifications": [
  {
    "uid": "your-notification-channel-uid"
  }
]
```

## Customizing the Alert

### Change Detection Window

To change how long the alert waits before triggering:

1. Edit the panel → **Alert** tab
2. Modify the **For** duration (currently 2 minutes)
3. Adjust the SQL query time intervals if needed

### Change Threshold

To make the alert more or less sensitive:

1. Edit the panel → **Alert** tab
2. In the condition, change the evaluator:
   - Current: `lte 0` (less than or equal to 0)
   - More sensitive: `lt 1` (less than 1 block)
   - Less sensitive: `lt -5` (only alert if height decreased)

### Change Check Frequency

1. Edit the panel → **Alert** tab
2. Modify **Evaluate every** (currently 30 seconds)
   - More frequent: 10s (more load on database)
   - Less frequent: 1m (slower detection)

## Testing the Alert

### Manual Test

1. Stop the metrics collector temporarily:
   ```bash
   # If running in a process, stop it
   # The alert should trigger after 2 minutes of no new data
   ```

2. Or simulate by modifying the query temporarily to always return 0

### Verify Alert is Active

1. Go to **Alerting** → **Alert rules**
2. Look for "Block Height Growth Stopped"
3. Check its state (should be "OK" if blocks are growing)

## Alert Query Explanation

The alert uses this SQL query:

```sql
SELECT
  (SELECT MAX(block_height) FROM network_metrics 
   WHERE time > NOW() - INTERVAL '1 minute') - 
  (SELECT MAX(block_height) FROM network_metrics 
   WHERE time > NOW() - INTERVAL '5 minutes' 
   AND time <= NOW() - INTERVAL '4 minutes') AS "Height Change"
```

This compares:
- **Recent height**: Maximum block height in the last 1 minute
- **Past height**: Maximum block height from 4-5 minutes ago

If the difference is ≤ 0, blocks aren't growing.

## Troubleshooting

### Alert Not Triggering

1. **Check data collection**: Ensure `collect_metrics.py` is running
   ```bash
   docker-compose exec postgres psql -U postgres -d gonka_tracker -c \
     "SELECT COUNT(*) FROM network_metrics WHERE time > NOW() - INTERVAL '10 minutes';"
   ```

2. **Check alert state**: Go to **Alerting** → **Alert rules**
3. **Check query**: Edit the panel and test the alert query manually

### False Positives

If the alert triggers too often:
- Increase the "For" duration (e.g., 5 minutes)
- Adjust the time window in the query
- Check if metrics collection is intermittent

### Alert Not Sending Notifications

1. Verify notification channel is configured correctly
2. Check channel is added to the alert
3. Test the notification channel separately
4. Check Grafana logs for errors

## Related Documentation

- [Grafana Alerting Documentation](https://grafana.com/docs/grafana/latest/alerting/)
- [Notification Channels](https://grafana.com/docs/grafana/latest/alerting/notifications/)
- Block Dashboard: `BLOCK_DASHBOARD.md`

## Example Notification Message

When the alert triggers, you'll receive a message like:

```
Alert: Block Height Growth Stopped

Block height has not increased in the last 5 minutes. The chain may be stalled.

Dashboard: Gonka Block Progression
Panel: Block Height Over Time
Current Block Height: 127540
Time: 2026-01-23 17:20:00 UTC
```
