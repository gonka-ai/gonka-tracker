# How Inference Counting Works

## Short Answer

**It depends on HOW you make the inference request:**

- ✅ **Via Decentralized API**: Counts towards on-chain stats
- ❌ **Direct to Node VLLM**: Does NOT count (bypasses blockchain)

## How Inference Counting Works

### The Flow

1. **Inference Request Made** → 
2. **Creates `MsgStartInference` Transaction** → 
3. **Transaction Broadcast to Blockchain** → 
4. **Blockchain Processes Transaction** → 
5. **Participant Stats Updated on Chain** → 
6. **Tracker Reads from Chain State**

### Where Stats Come From

The tracker's `current_epoch_stats.inference_count` comes from **blockchain state**, not from the node directly. The tracker queries:

```
/chain-api/productscience/inference/inference/participant
```

This returns participant data including `current_epoch_stats` which is stored **on the blockchain**.

## Two Ways to Make Inference Requests

### Method 1: Through Decentralized API (Counts ✅)

When you use the **decentralized API** (public API gateway):

```bash
# Using gonka-openai SDK (recommended)
from gonka_openai import GonkaOpenAI

client = GonkaOpenAI(
    gonka_private_key="0x...",
    source_url="https://api.gonka.ai"  # Decentralized API
)

# This creates a blockchain transaction → COUNTS
response = client.chat.completions.create(...)
```

**What happens:**
1. Request goes to decentralized API
2. API creates `MsgStartInference` transaction
3. Transaction is signed and broadcast to blockchain
4. Blockchain processes it and updates participant stats
5. Tracker reads updated stats from chain

### Method 2: Direct to Node VLLM (Does NOT Count ❌)

When you make a request **directly to a node's VLLM endpoint**:

```bash
# Direct VLLM request (bypasses blockchain)
curl -X POST "http://xj7-5.s.filfox.io:19254/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"model": "...", "messages": [...]}'
```

**What happens:**
1. Request goes directly to node's VLLM service
2. VLLM processes inference locally
3. **NO blockchain transaction is created**
4. **Stats are NOT updated on chain**
5. Tracker still shows 0 (because it reads from chain)

## Why Direct Node Requests Don't Count

Direct VLLM requests:
- Process inference locally on the node
- Don't create blockchain transactions
- Don't update on-chain participant stats
- Don't go through the validation/consensus system
- Don't count towards rewards or reputation

This is by design - the blockchain needs to track all inferences for:
- Rewards calculation
- Reputation tracking
- Validation and consensus
- Network statistics

## How to Make Requests That Count

### Option 1: Use Decentralized API (Recommended)

```python
from gonka_openai import GonkaOpenAI

client = GonkaOpenAI(
    gonka_private_key="YOUR_PRIVATE_KEY",
    source_url="https://api.gonka.ai"  # Or your testnet's public API
)

# This will count!
response = client.chat.completions.create(
    model="Qwen/Qwen2.5-7B-Instruct",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

### Option 2: Use Decentralized API via curl (If Available)

If your testnet has a decentralized API endpoint:

```bash
# This would count (if properly authenticated)
curl -X POST "https://api.gonka.testnet.example.com/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "X-Requester-Address: YOUR_ADDRESS" \
  -H "Authorization: YOUR_SIGNATURE" \
  -H "X-Timestamp: $(date +%s)000" \
  -d '{"model": "...", "messages": [...]}'
```

## Checking If Your Requests Counted

After making requests through the decentralized API:

1. **Wait for transaction to be included in a block** (usually a few seconds)
2. **Check tracker**:
   ```bash
   curl -s "http://localhost/api/v1/inference/current" | jq '.participants[] | select(.address == "YOUR_NODE_ADDRESS") | .current_epoch_stats.inference_count'
   ```

3. **Force tracker refresh** (if needed):
   ```bash
   curl -s "http://localhost/api/v1/inference/current?reload=true" | jq
   ```

## Why You're Seeing Zero

If you're seeing `inference_count: 0`:

1. **Direct node requests**: If you made requests directly to `xj7-5.s.filfox.io:19254/v1/chat/completions`, these don't count
2. **No requests made**: No inference requests have been made through the decentralized API
3. **Transaction not processed**: Requests were made but transactions haven't been included in blocks yet
4. **Wrong epoch**: Requests were made in a different epoch
5. **Tracker not synced**: Tracker might need to refresh its cache

## Testing: Make a Request That Counts

To test if requests count:

1. **Set up developer account** (see `GONKA_DEVELOPER_AUTH.md`)
2. **Get your private key**
3. **Use the SDK to make a request**:
   ```python
   from gonka_openai import GonkaOpenAI
   
   client = GonkaOpenAI(
       gonka_private_key="YOUR_KEY",
       source_url="YOUR_DECENTRALIZED_API_URL"
   )
   
   response = client.chat.completions.create(
       model="Qwen/Qwen2.5-7B-Instruct",
       messages=[{"role": "user", "content": "Test"}],
       max_tokens=50
   )
   ```

4. **Wait ~10-30 seconds** for transaction to be processed
5. **Check tracker**:
   ```bash
   curl -s "http://localhost/api/v1/inference/current?reload=true" | jq '.participants[].current_epoch_stats.inference_count'
   ```

## Summary

| Request Method | Creates Transaction? | Counts in Stats? |
|---------------|---------------------|------------------|
| Decentralized API (gonka-openai SDK) | ✅ Yes | ✅ Yes |
| Decentralized API (curl with auth) | ✅ Yes | ✅ Yes |
| Direct to node VLLM | ❌ No | ❌ No |

**To make requests that count**, you must use the decentralized API, not direct node access.
