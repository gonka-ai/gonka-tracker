#!/bin/bash
# Correct way to register account on testnet

PUBKEY="A3c9Uvocrk3bl8r+wuDf1yuGZxN02iu660yiSGusOSTv"
ADDRESS="gonka1fee0zveeuwd2p9ttvfh0ue0za6623daxf2h6gh"

# The correct endpoint is /v1/participants (not /v1/participants/unfunded)
# For CLIENT accounts, you only need address and pub_key
# Url, ValidatorKey, and WorkerKey are optional (only needed for nodes)

echo "Registering account as unfunded participant..."
echo "  Address: $ADDRESS"
echo "  Public Key: $PUBKEY"
echo ""

# Try the seed node (genesis node that accepts registrations)
# Based on your config, this might be:
SEED_NODE="http://node2.gonka.ai:8000"
# Or internal:
# SEED_NODE="http://172.18.114.104:8000"

curl -X POST "${SEED_NODE}/v1/participants" \
  -H "Content-Type: application/json" \
  -d "{
    \"address\": \"$ADDRESS\",
    \"pub_key\": \"$PUBKEY\"
  }"

echo ""
echo ""
echo "If that doesn't work, try with the internal seed node:"
echo "curl -X POST \"http://172.18.114.104:8000/v1/participants\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"address\": \"$ADDRESS\", \"pub_key\": \"$PUBKEY\"}'"
