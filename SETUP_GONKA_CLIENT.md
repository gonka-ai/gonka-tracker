# How to Set Up GonkaOpenAI Client

Step-by-step guide to create the client with private key and source URL.

## Step 1: Install Required Tools

### Install `inferenced` Binary

You need the `inferenced` CLI tool to create accounts and manage keys:

```bash
# Download inferenced binary (check gonka.ai docs for latest version)
# Make it executable
chmod +x inferenced

# Move to PATH (optional)
sudo mv inferenced /usr/local/bin/
```

### Install Python SDK

```bash
pip install gonka-openai
```

## Step 2: Create a Developer Account

### Option A: Create New Account Locally

```bash
# Create a new account
inferenced keys add my-dev-account --keyring-backend test

# This will output:
# - name: my-dev-account
# - type: local
# - address: gonka1abc123...
# - pubkey: AueT4ZgGOzdZemlpqjAwfmwN2WAvEPhsBNbfbhUNNhGp
# - mnemonic: [12 or 24 word phrase] ⚠️ SAVE THIS SECURELY
```

**Important**: Save the mnemonic phrase securely - this is your only way to recover the account!

### Option B: Use Existing Account from Node Container

If you have a node running, you can use an existing key:

```bash
# Access the node container
docker exec -it <node-container-name> /bin/sh

# List existing keys
inferenced keys list --keyring-backend test

# Export a key (if needed)
inferenced keys export <key-name> --keyring-backend test
```

## Step 3: Get Your Private Key

### Method 1: Export from Keyring

```bash
# Export private key (you'll be prompted for passphrase)
inferenced keys export my-dev-account --keyring-backend test --output-file key.pem

# The private key will be in the PEM file
# Format: hex-encoded ECDSA private key
```

### Method 2: Extract from Mnemonic (If You Have It)

If you have the mnemonic phrase, you can derive the private key:

```python
from mnemonic import Mnemonic
from eth_account import Account

mnemonic = "your twelve word mnemonic phrase here"
Account.enable_unaudited_hdwallet_features()
account = Account.from_mnemonic(mnemonic)
private_key = account.key.hex()  # This is your private key
```

### Method 3: Get from Node Container

```bash
# If you have access to a node container with keys
docker exec -it <container> inferenced keys show <key-name> --keyring-backend test --keyring-dir /root/.inference

# Or export it
docker exec -it <container> inferenced keys export <key-name> --keyring-backend test
```

## Step 4: Get the Source URL (Decentralized API)

The `source_url` should point to the **decentralized API**, not a node URL.

### For Testnet

```bash
# Check if there's a public API endpoint
# Common patterns:
# - https://api.gonka.testnet.example.com
# - http://testnet-api.gonka.ai
# - Or use a node that proxies the decentralized API

# You can also check your testnet documentation
```

### For Local Testnet

If running a local testnet, find the decentralized API URL:

```bash
# Check docker-compose or deployment config
grep -r "PUBLIC_URL\|API_URL" your-testnet-config/

# Or check if there's a proxy/nginx that routes to decentralized API
```

### Get from Tracker (If Available)

```bash
# Some trackers might expose the public API URL
curl -s "http://localhost/api/v1/inference/current" | jq '.public_api_url'
```

## Step 5: Create the Client

### Basic Setup

```python
from gonka_openai import GonkaOpenAI

# Your private key (hex format, with or without 0x prefix)
PRIVATE_KEY = "0x1234567890abcdef..."  # 64 hex characters

# Your decentralized API URL
SOURCE_URL = "https://api.gonka.ai"  # Or your testnet URL

# Create client
client = GonkaOpenAI(
    gonka_private_key=PRIVATE_KEY,
    source_url=SOURCE_URL
)

# Test it
response = client.chat.completions.create(
    model="Qwen/Qwen2.5-7B-Instruct",
    messages=[{"role": "user", "content": "Hello!"}],
    max_tokens=50
)

print(response.choices[0].message.content)
```

### Using Environment Variable

```python
import os
from gonka_openai import GonkaOpenAI

# Set environment variable
os.environ["GONKA_PRIVATE_KEY"] = "0x1234..."

# Client will auto-load from env
client = GonkaOpenAI(
    source_url="https://api.gonka.ai"
)
```

## Step 6: Complete Example Script

```python
#!/usr/bin/env python3
"""
Example: Setting up and using GonkaOpenAI client
"""

from gonka_openai import GonkaOpenAI
import os

# Configuration
PRIVATE_KEY = os.getenv("GONKA_PRIVATE_KEY", "0xYOUR_PRIVATE_KEY_HERE")
SOURCE_URL = os.getenv("GONKA_API_URL", "https://api.gonka.ai")

def main():
    # Create client
    print(f"Connecting to: {SOURCE_URL}")
    client = GonkaOpenAI(
        gonka_private_key=PRIVATE_KEY,
        source_url=SOURCE_URL
    )
    
    # Make a test request
    print("Making inference request...")
    try:
        response = client.chat.completions.create(
            model="Qwen/Qwen2.5-7B-Instruct",
            messages=[
                {"role": "user", "content": "What is 2+2?"}
            ],
            max_tokens=50,
            temperature=0.7
        )
        
        print("✅ Success!")
        print(f"Response: {response.choices[0].message.content}")
        print(f"Usage: {response.usage}")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
```

Run it:
```bash
export GONKA_PRIVATE_KEY="0x..."
export GONKA_API_URL="https://api.gonka.ai"
python3 example.py
```

## Troubleshooting

### "Invalid private key format"

The private key should be:
- Hex-encoded (64 hex characters)
- With or without `0x` prefix
- Example: `0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`

### "Connection refused" or "Not Found"

- Check that `source_url` points to the **decentralized API**, not a node
- Verify the URL is accessible: `curl https://api.gonka.ai/v1/status`
- For testnet, use the correct testnet API URL

### "Authorization required"

- Make sure you're using the decentralized API, not direct node access
- Verify your private key is correct
- Check that your account is registered on the network

### Finding Your Testnet API URL

If you're not sure what the `source_url` should be:

1. **Check testnet documentation**
2. **Look for decentralized API service** in your deployment
3. **Try common patterns**:
   ```bash
   # Test common URLs
   curl "https://api.gonka.testnet.example.com/v1/status"
   curl "http://testnet-api.gonka.ai/v1/status"
   ```

4. **Check node proxy** - some nodes proxy the decentralized API:
   ```bash
   curl "http://xj7-5.s.filfox.io:19254/v1/status"  # Might work if node proxies API
   ```

## Quick Reference

```python
# Minimal setup
from gonka_openai import GonkaOpenAI

client = GonkaOpenAI(
    gonka_private_key="0xYOUR_64_CHAR_HEX_KEY",
    source_url="https://api.gonka.ai"  # Your decentralized API URL
)

# Make request
response = client.chat.completions.create(
    model="Qwen/Qwen2.5-7B-Instruct",
    messages=[{"role": "user", "content": "Hello"}]
)
```

## Security Notes

⚠️ **Never commit private keys to version control!**

```python
# ✅ Good: Use environment variables
import os
private_key = os.getenv("GONKA_PRIVATE_KEY")

# ❌ Bad: Hardcoded keys
private_key = "0x1234..."  # DON'T DO THIS
```

Use `.env` files (and add to `.gitignore`):
```bash
# .env
GONKA_PRIVATE_KEY=0x...
GONKA_API_URL=https://api.gonka.ai
```

```python
# Load from .env
from dotenv import load_dotenv
load_dotenv()

private_key = os.getenv("GONKA_PRIVATE_KEY")
```

## Next Steps

After setting up the client:
1. **Test with a simple request** (see example above)
2. **Wait 10-30 seconds** for transaction to be processed
3. **Check tracker** to verify inference counted:
   ```bash
   curl -s "http://localhost/api/v1/inference/current?reload=true" | jq '.participants[].current_epoch_stats.inference_count'
   ```

## Related Documentation

- **Developer Auth**: See `GONKA_DEVELOPER_AUTH.md` for authentication details
- **Inference Requests**: See `INFERENCE_REQUESTS.md` for making requests
- **Official Docs**: https://gonka.ai/developer/quickstart/
