# Gonka.ai Developer API Authentication Setup

Based on official Gonka.ai documentation, this guide explains how to set up authentication for developers.

## Important: Gonka Uses Cryptographic Signatures, Not API Keys

**Gonka.ai does NOT use traditional API keys.** Instead, it uses **ECDSA private key cryptography** to sign inference requests. This provides:
- **Cryptographically verifiable inference**: Each request is signed and can be verified
- **Censorship resistance**: No central authority controls access
- **Transparent audit trails**: All interactions are signed and timestamped

## Step 1: Create a Developer Account

### Set Environment Variables

Before creating an account, set these environment variables:

```bash
export ACCOUNT_NAME=<your-desired-account-name>
export NODE_URL=<http://random-node-url>
```

**Notes:**
- `ACCOUNT_NAME`: Your chosen identifier (stored locally, NOT on-chain)
- `NODE_URL`: Select a random node URL from:
  - Genesis nodes list
  - Current list of active participants (from `/api/v1/inference/current`)

**Why random node selection?** It helps distribute network load and improves resilience. All nodes expose the same public API and function as gateways.

### Get Node URLs

You can get node URLs from the tracker:

```bash
# Get current participants with their inference URLs
curl -s "http://localhost/api/v1/inference/current" | jq '.participants[] | {address: .address, inference_url: .inference_url}'
```

## Step 2: Key Management

Gonka uses a **three-key system** for security:

### Key Types

1. **Account Key** (SECP256K1)
   - **Purpose**: Master control key for high-stakes operations
   - **Storage**: **OFFLINE** on a secure, air-gapped machine
   - **Usage**: Only for critical operations and permissions
   - **⚠️ CRITICAL**: If lost, all access is permanently lost
   - **Backup**: Always securely store your mnemonic phrase

2. **ML Operational Key** (SECP256K1)
   - **Purpose**: Automated AI transactions and inference requests
   - **Storage**: Encrypted on server
   - **Usage**: For programmatic access and routine operations
   - **Keyring**: Use `file` keyring backend for server-based storage

3. **Consensus Key** (ED25519)
   - **Purpose**: Network validation and block consensus
   - **Storage**: Managed by TMKMS service
   - **Usage**: For validators only

### Key Management Options

**Option 1 (Recommended):** Access account directly from Docker container
```bash
docker exec -it node /bin/sh
# Then use inferenced commands inside the container
```

**Option 2:** Export keys locally
```bash
# Inside container
inferenced keys export $KEY_NAME --keyring-backend test

# On local machine
inferenced keys import join keys.pem --keyring-backend test
```

## Step 3: Making Authenticated Requests

### Using Python SDK (Recommended)

The `gonka-openai` Python library simplifies authentication:

```bash
pip install gonka-openai
```

```python
from gonka_openai import GonkaOpenAI

# Initialize client with your private key
client = GonkaOpenAI(
    gonka_private_key="0x1234...",  # Your ECDSA private key
    source_url="https://api.gonka.ai"  # Or your node URL
)

# Make requests - signing happens automatically
response = client.chat.completions.create(
    model="Qwen/Qwen2.5-7B-Instruct",
    messages=[
        {"role": "user", "content": "Hello!"}
    ],
    max_tokens=100
)
```

### Using curl with Manual Signing

For direct HTTP requests, you need to:

1. **Sign the request** with your ECDSA private key
2. **Include required headers**:
   - `X-Requester-Address`: Your Gonka address
   - `Authorization`: Cryptographic signature
   - `X-Timestamp`: Current timestamp in milliseconds

**Example:**
```bash
# You'll need to sign the request first (requires crypto library)
# This is complex - use the SDK instead

curl -X POST "https://api.gonka.ai/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "X-Requester-Address: YOUR_GONKA_ADDRESS" \
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

**Note**: Manual signing requires cryptographic libraries. The SDK handles this automatically.

## Step 4: Environment Variable Setup

You can also provide the private key via environment variable:

```bash
export GONKA_PRIVATE_KEY="0x1234..."  # Your ECDSA private key
```

Then the SDK will automatically use it:

```python
from gonka_openai import GonkaOpenAI

# Private key loaded from GONKA_PRIVATE_KEY env var
client = GonkaOpenAI(
    source_url="https://api.gonka.ai"
)
```

## Key Security Best Practices

1. **Never store Account Key online**
   - Keep it on an air-gapped machine
   - Use hardware wallets if possible

2. **Backup your mnemonic phrase**
   - Store in secure, offline location
   - Loss = permanent access loss

3. **Use ML Operational Key for routine operations**
   - Rotate regularly using Account Key authorization
   - Store encrypted on server

4. **Never commit private keys to version control**
   - Use environment variables
   - Use secrets management systems

## Pricing Information

**Important**: During the initial network phase (approximately 90 days until ~November 20, 2025), all inference costs are **zero** due to the `GracePeriodEndEpoch` governance parameter.

After the grace period, dynamic pricing will be enabled.

## API Compatibility

The Gonka API is **compatible with OpenAI-style endpoints**, enabling developers to migrate existing applications with minimal code changes. Simply replace the OpenAI client with `GonkaOpenAI`.

## Official Documentation Links

- **Developer Quickstart**: https://gonka.ai/developer/quickstart/
- **Key Management Architecture**: https://gonka.ai/host/key-management/
- **Network Node API**: https://gonka.ai/host/network-node-api/
- **Python SDK**: https://pypi.org/project/gonka-openai/

## Troubleshooting

### "Authorization is required" Error

If you see this error when accessing nodes directly:
- The node may have additional authentication middleware
- Use the public decentralized API instead
- Or contact the node operator for access

### Private Key Format

- ECDSA private keys are typically hex-encoded
- Format: `0x` prefix followed by 64 hex characters
- Example: `0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`

### Getting Your Address

Your Gonka address is derived from your public key. You can get it using:

```bash
# Inside inferenced container
inferenced keys show $KEY_NAME --keyring-backend test
```

## Summary

1. **Set environment variables**: `ACCOUNT_NAME` and `NODE_URL`
2. **Create account**: Use `inferenced` commands
3. **Get private key**: Export from keyring or use existing key
4. **Use SDK**: Install `gonka-openai` and provide private key
5. **Make requests**: SDK handles signing automatically

**Remember**: Gonka uses cryptographic signatures, not API keys. You need an ECDSA private key to authenticate requests.
