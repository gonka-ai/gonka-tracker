# Making Inference Requests to Gonka Nodes

This guide shows how to make inference requests directly to Gonka Chain nodes using curl commands.

## Step 1: Get Node Information

First, get the list of available nodes and their inference URLs:

```bash
# Get current participants with their inference URLs
curl -s "http://localhost/api/v1/inference/current" | jq '.participants[] | {address: .address, inference_url: .inference_url, models: .models, node_healthy: .node_healthy}'
```

Or get a specific participant's details:

```bash
# Replace PARTICIPANT_ADDRESS with actual address
curl -s "http://localhost/api/v1/participants/PARTICIPANT_ADDRESS?epoch_id=354" | jq '.participant | {address: .address, inference_url: .inference_url, models: .models}'
```

**Example output:**
```json
{
  "address": "gonka18s2h4n97txsyxntc0hk09zc9rtkq4dg8wn6d53",
  "inference_url": "http://172.18.114.102:8000",
  "models": ["Qwen/Qwen2.5-7B-Instruct"],
  "node_healthy": true
}
```

## Step 2: Check Node Health

Before making inference requests, verify the node is healthy:

```bash
# Replace INFERENCE_URL with the node's inference_url from step 1
curl -X GET "http://172.18.114.102:8000/health"
```

**Expected response:** HTTP 200 OK (empty body or JSON status)

## Step 3: Make Inference Request

Nodes expose VLLM-compatible endpoints. Use the `/v1/chat/completions` endpoint:

### Basic Chat Completion Request

```bash
# Replace INFERENCE_URL and MODEL_NAME with values from step 1
curl -X POST "http://172.18.114.102:8000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen2.5-7B-Instruct",
    "messages": [
      {"role": "user", "content": "What is the capital of France?"}
    ],
    "max_tokens": 100,
    "temperature": 0.7,
    "stream": false
  }'
```

### With Pretty Print (using jq)

```bash
curl -X POST "http://172.18.114.102:8000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen2.5-7B-Instruct",
    "messages": [
      {"role": "user", "content": "Explain quantum computing in simple terms."}
    ],
    "max_tokens": 200,
    "temperature": 0.5
  }' | jq
```

### Advanced Request with System Message

```bash
curl -X POST "http://172.18.114.102:8000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen2.5-7B-Instruct",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Write a short poem about AI."}
    ],
    "max_tokens": 150,
    "temperature": 0.8,
    "top_p": 0.9,
    "seed": 42
  }' | jq
```

## Request Parameters

### Required Parameters
- **`model`**: Model name (e.g., `"Qwen/Qwen2.5-7B-Instruct"`)
- **`messages`**: Array of message objects with `role` and `content`
  - `role`: `"system"`, `"user"`, or `"assistant"`
  - `content`: Message text

### Optional Parameters
- **`max_tokens`**: Maximum tokens to generate (default: varies by model)
- **`temperature`**: Sampling temperature (0.0-2.0, default: 1.0)
  - Lower = more deterministic
  - Higher = more creative
- **`top_p`**: Nucleus sampling parameter (0.0-1.0)
- **`seed`**: Random seed for reproducibility
- **`stream`**: Whether to stream responses (default: `false`)
- **`logprobs`**: Include log probabilities (default: `false`)
- **`top_logprobs`**: Number of top logprobs to return (if `logprobs: true`)

## Response Format

**Success Response (200 OK):**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "Qwen/Qwen2.5-7B-Instruct",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "The capital of France is Paris."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 7,
    "total_tokens": 17
  }
}
```

**Error Response (4xx/5xx):**
```json
{
  "error": {
    "message": "Error description",
    "type": "invalid_request_error",
    "code": "model_not_found"
  }
}
```

## Complete Example Workflow

```bash
# 1. Get available nodes
NODES=$(curl -s "http://localhost/api/v1/inference/current" | jq -r '.participants[] | select(.node_healthy == true) | "\(.address)|\(.inference_url)|\(.models[0])"')

# 2. Extract first healthy node's info
IFS='|' read -r ADDRESS INFERENCE_URL MODEL <<< "$(echo "$NODES" | head -1)"

echo "Using node: $ADDRESS"
echo "Inference URL: $INFERENCE_URL"
echo "Model: $MODEL"

# 3. Check health
echo "Checking node health..."
curl -s "$INFERENCE_URL/health" && echo " - Node is healthy" || echo " - Node is unhealthy"

# 4. Make inference request
echo "Making inference request..."
curl -X POST "$INFERENCE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$MODEL\",
    \"messages\": [
      {\"role\": \"user\", \"content\": \"Hello! Can you help me?\"}
    ],
    \"max_tokens\": 100,
    \"temperature\": 0.7
  }" | jq '.choices[0].message.content'
```

## Streaming Requests

For streaming responses (useful for long completions):

```bash
curl -X POST "http://172.18.114.102:8000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen2.5-7B-Instruct",
    "messages": [
      {"role": "user", "content": "Write a long story about space exploration."}
    ],
    "max_tokens": 500,
    "stream": true
  }' \
  --no-buffer
```

Streaming responses come as Server-Sent Events (SSE) with `data:` prefixes.

## Troubleshooting

### Node Not Responding

1. **Check if node is healthy:**
   ```bash
   curl -v "http://INFERENCE_URL/health"
   ```

2. **Check if node is accessible:**
   ```bash
   # If inference_url is internal IP, you may need to be on the same network
   # Or use port forwarding/SSH tunnel
   ```

3. **Verify node status in tracker:**
   ```bash
   curl -s "http://localhost/api/v1/inference/current" | jq '.participants[] | select(.inference_url == "http://YOUR_URL") | {address, node_healthy, node_health_checked_at}'
   ```

### Model Not Found Error

- Verify the model name matches exactly what's in the participant's `models` array
- Check if the model is loaded on the node (may require `/api/v1/inference/up` setup)

### Connection Refused

- Node may be behind a firewall
- Node may be on a private network (requires VPN/tunnel)
- Node may be down or restarting

## Node Management Endpoints

Nodes also expose management endpoints (if you have access):

### Start Inference Service
```bash
curl -X POST "http://INFERENCE_URL/api/v1/inference/up" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen2.5-7B-Instruct",
    "dtype": "float16",
    "additional_args": []
  }'
```

### Stop Inference Service
```bash
curl -X POST "http://INFERENCE_URL/api/v1/inference/down"
```

### Check Inference Status
```bash
curl -X GET "http://INFERENCE_URL/api/v1/inference/up/status"
```

## Authentication

Many nodes require authentication. The error `{"error":"Authorization is required"}` indicates the node needs authentication headers.

### Option 1: API Key / Bearer Token

Some nodes use API keys or bearer tokens:

```bash
# With API key in header
curl -X POST "http://xj7-5.s.filfox.io:19254/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "Qwen/Qwen2.5-7B-Instruct",
    "messages": [
      {"role": "user", "content": "What is the capital of France?"}
    ],
    "max_tokens": 100
  }'
```

### Option 2: Custom Authorization Header

Some nodes may use custom authorization formats:

```bash
curl -X POST "http://xj7-5.s.filfox.io:19254/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: YOUR_TOKEN" \
  -d '{
    "model": "Qwen/Qwen2.5-7B-Instruct",
    "messages": [
      {"role": "user", "content": "What is the capital of France?"}
    ],
    "max_tokens": 100
  }'
```

### Option 3: Through Decentralized API (Public Endpoint)

If direct node access requires complex authentication, use the public decentralized API which handles authentication:

```bash
# Get public API URL from tracker
PUBLIC_API_URL="https://api.gonka.ai"  # Replace with actual public API URL

curl -X POST "$PUBLIC_API_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "X-Requester-Address: YOUR_ADDRESS" \
  -H "Authorization: YOUR_SIGNATURE" \
  -H "X-Timestamp: $(date +%s)000" \
  -d '{
    "model": "Qwen/Qwen2.5-7B-Instruct",
    "messages": [
      {"role": "user", "content": "What is the capital of France?"}
    ],
    "max_tokens": 100
  }'
```

**Note**: The decentralized API requires:
- `X-Requester-Address`: Your Gonka address
- `Authorization`: Cryptographic signature
- `X-Timestamp`: Current timestamp in milliseconds

### Getting Authentication Credentials

**Important**: Gonka.ai uses **cryptographic signatures with ECDSA private keys**, not traditional API keys. See `GONKA_DEVELOPER_AUTH.md` for complete setup instructions.

**Quick Setup:**
1. **Install Python SDK**: `pip install gonka-openai`
2. **Get your private key**: Export from your Gonka account keyring
3. **Use SDK**: The SDK automatically signs requests with your private key

**For direct node access:**
1. **Contact Node Operator**: Some nodes may have additional authentication middleware
2. **Check Node Documentation**: Some nodes provide public documentation
3. **Use Public API**: Use the public decentralized API which handles authentication automatically

## Security Notes

- **Internal Networks**: Many inference URLs use internal IPs (e.g., `172.18.x.x`). You may need:
  - VPN access to the network
  - SSH tunnel/port forwarding
  - Direct network access

- **Authentication**: Most nodes require authentication. Options include:
  - API keys / Bearer tokens
  - Cryptographic signatures (for decentralized API)
  - Custom authentication schemes

- **Rate Limiting**: Nodes may have rate limits. Respect them to avoid being blocked.

## Related Documentation

- **API Endpoints**: See `API_ENDPOINTS.md` for tracker API documentation
- **Node Setup**: See node operator documentation for inference service setup
- **VLLM Documentation**: Nodes use VLLM, see [vLLM docs](https://docs.vllm.ai/) for advanced features
