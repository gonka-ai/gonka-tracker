#!/bin/bash
# Quick inference activity checker

API_URL="http://localhost/api/v1"
DATA=$(curl -s "${API_URL}/inference/current")
EPOCH=$(echo "$DATA" | jq -r '.epoch_id')
TOTAL=$(echo "$DATA" | jq '[.participants[].current_epoch_stats.inference_count] | add')

echo "=== Quick Inference Activity Check ==="
echo "Epoch: $EPOCH"
echo "Total Inferences: $TOTAL"
echo ""

if [ "$TOTAL" -gt 0 ]; then
    echo "✅ Activity detected!"
    echo ""
    echo "Nodes with activity:"
    echo "$DATA" | jq -r '.participants[] | select(.current_epoch_stats.inference_count > 0) | "  \(.address[:40])... - \(.current_epoch_stats.inference_count) inferences"'
else
    echo "❌ No inference activity"
fi
