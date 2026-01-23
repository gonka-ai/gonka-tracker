# How to Register Your Account on the Testnet

There are two scenarios:
1. **Registering as a CLIENT** (just making inference requests) - Usually doesn't require registration
2. **Registering as a PARTICIPANT/NODE** (serving inference requests) - Requires registration

## Scenario 1: Registering as a CLIENT (For Making Inference Requests)

If you just want to make inference requests (not run a node), you typically **don't need to register**. However, your account needs to exist on-chain. This can happen:

### Option A: Account Auto-Creation (First Transaction)
Some chains auto-create accounts on the first transaction. Try making an inference request - if it fails with "account not found", proceed to Option B.

### Option B: Use a Faucet (If Available)
Check if your testnet has a faucet to fund accounts:

```bash
# Check testnet documentation for faucet URL
# Example (replace with actual faucet):
curl -X POST "http://faucet-url/request" \
  -H "Content-Type: application/json" \
  -d '{"address": "gonka1fee0zveeuwd2p9ttvfh0ue0za6623daxf2h6gh"}'
```

### Option C: Get Account Public Key and Register via API

If you need to explicitly create the account:

1. **Get your account public key:**
   ```bash
   inferenced keys show my-dev-account --pubkey --keyring-backend test
   ```

2. **Get your address:**
   ```bash
   inferenced keys show my-dev-account --address --keyring-backend test
   ```

3. **Submit to unfunded participant endpoint** (if available):
   ```bash
   curl -X POST "http://172.18.114.103:8000/v1/participants/unfunded" \
     -H "Content-Type: application/json" \
     -d '{
       "address": "gonka1fee0zveeuwd2p9ttvfh0ue0za6623daxf2h6gh",
       "pub_key": "YOUR_BASE64_PUBLIC_KEY"
     }'
   ```

## Scenario 2: Registering as a PARTICIPANT/NODE

If you're running a node and want to serve inference requests, use the `register-new-participant` command.

### Step 1: Get Your Account Public Key

```bash
# If key is already in keyring
inferenced keys show my-dev-account --pubkey --keyring-backend test

# Output will be base64-encoded, like:
# A3c9Uvocrk3bl8r+wuDf1yuGZxN02iu660yiSGusOSTv
```

### Step 2: Get Your Node URL

This is the public URL where your node's decentralized API is accessible:
- For your testnet: `http://xj7-5.s.filfox.io:19254` (or your specific node URL)
- Or internal: `http://172.18.114.103:8000` (if registering from within the network)

### Step 3: Find the Seed Node Address

The seed node is the genesis node that accepts registrations. Based on your testnet setup:

```bash
# Check your testnet config for SEED_API_URL
# Common values:
# - http://node2.gonka.ai:8000
# - http://172.18.114.104:8000 (internal)
# - Check DAPI_CHAIN_NODE__SEED_API_URL in your config
```

### Step 4: Register the Participant

#### Method A: Using inferenced CLI (Recommended)

```bash
inferenced register-new-participant \
  <your-node-url> \
  <your-account-public-key-base64> \
  --node-address <seed-node-url>
```

**Example:**
```bash
inferenced register-new-participant \
  "http://xj7-5.s.filfox.io:19254" \
  "A3c9Uvocrk3bl8r+wuDf1yuGZxN02iu660yiSGusOSTv" \
  --node-address "http://node2.gonka.ai:8000"
```

#### Method B: Using curl (Direct API)

```bash
# Get your address
ADDRESS=$(inferenced keys show my-dev-account --address --keyring-backend test)

# Get your public key
PUBKEY=$(inferenced keys show my-dev-account --pubkey --keyring-backend test | jq -r '.key')

# Register via API
curl -X POST "http://node2.gonka.ai:8000/v1/participants" \
  -H "Content-Type: application/json" \
  -d "{
    \"address\": \"$ADDRESS\",
    \"url\": \"http://xj7-5.s.filfox.io:19254\",
    \"pub_key\": \"$PUBKEY\",
    \"validator_key\": \"<consensus-key-if-needed>\",
    \"worker_key\": \"\"
  }"
```

### Step 5: Verify Registration

After registration, verify your participant exists:

```bash
# Check via API
curl "http://node2.gonka.ai:8000/v1/participants/gonka1fee0zveeuwd2p9ttvfh0ue0za6623daxf2h6gh"

# Or via inferenced
inferenced query inference participant gonka1fee0zveeuwd2p9ttvfh0ue0za6623daxf2h6gh \
  --node http://172.18.114.103:26657
```

## For Your Specific Testnet

Based on your setup files, here's what you need:

1. **Seed Node URL**: Check your config for `DAPI_CHAIN_NODE__SEED_API_URL` or use `http://node2.gonka.ai:8000`

2. **Your Node URL**: 
   - External: `http://xj7-5.s.filfox.io:19254`
   - Internal: `http://172.18.114.103:8000`

3. **Account Public Key**: Get it with:
   ```bash
   inferenced keys show my-dev-account --pubkey --keyring-backend test
   ```

4. **Run Registration**:
   ```bash
   inferenced register-new-participant \
     "http://xj7-5.s.filfox.io:19254" \
     "$(inferenced keys show my-dev-account --pubkey --keyring-backend test | jq -r '.key')" \
     --node-address "http://node2.gonka.ai:8000"
   ```

## Troubleshooting

### "Account not found" Error
- The account needs to exist on-chain first
- Try making a transaction or using a faucet
- Or use the unfunded participant endpoint if available

### "Connection refused" or "Timeout"
- Verify the seed node URL is correct
- Check if the seed node is accessible from your location
- Try using the internal IP if you're on the same network

### "Invalid public key"
- Ensure the public key is base64-encoded
- Use `jq -r '.key'` to extract just the key value from inferenced output

### "Participant already exists"
- Your account is already registered
- You can proceed to use it for inference requests

## Quick Registration Script

```bash
#!/bin/bash
# Quick registration script for your testnet

ACCOUNT_NAME="my-dev-account"
NODE_URL="http://xj7-5.s.filfox.io:19254"
SEED_NODE="http://node2.gonka.ai:8000"

# Get public key
PUBKEY=$(inferenced keys show $ACCOUNT_NAME --pubkey --keyring-backend test | jq -r '.key')

echo "Registering participant..."
echo "  Account: $ACCOUNT_NAME"
echo "  Node URL: $NODE_URL"
echo "  Seed Node: $SEED_NODE"
echo "  Public Key: $PUBKEY"

inferenced register-new-participant \
  "$NODE_URL" \
  "$PUBKEY" \
  --node-address "$SEED_NODE"
```

## Important Notes

- **For CLIENT accounts**: You usually don't need to register as a participant. Just ensure the account exists on-chain (via faucet or first transaction).

- **For NODE accounts**: Registration is required if you want to serve inference requests.

- **Consensus Key**: Only needed if you're running a validator node. For regular participants, it may be optional or auto-fetched.
