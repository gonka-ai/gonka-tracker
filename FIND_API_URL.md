# How to Find the Correct Decentralized API URL

The error you're seeing is a **connection timeout**. The client is trying to connect to `http://172.18.114.104:8000`, which is likely an internal Docker network IP that's not accessible from your machine.

## The Problem

`gonka-openai` needs the **Decentralized API URL**, not a node URL. The decentralized API is the gateway that:
- Accepts signed inference requests
- Routes them to nodes
- Records transactions on-chain

## Finding Your Decentralized API URL

### Method 1: Check Your Testnet Documentation

Look for documentation that specifies the decentralized API endpoint. Common patterns:
- `https://api.gonka.ai` (mainnet)
- `http://<testnet-domain>:8080` (testnet)
- `http://<testnet-domain>:30000` (testnet)

### Method 2: Check Docker/Container Logs

If you're running a local testnet:

```bash
# Find decentralized API container
docker ps | grep -i api

# Check logs for the public URL
docker logs <api-container-name> | grep -i "public\|url\|listening"
```

### Method 3: Check Environment Variables

If you have access to the API container:

```bash
# Access the container
docker exec -it <api-container> /bin/sh

# Check environment variables
env | grep -i "url\|api\|public"
```

### Method 4: Check Configuration Files

Look for config files that specify the public URL:

```bash
# Search for config files
find . -name "*.yaml" -o -name "*.yml" -o -name "config.env" | xargs grep -i "public_url\|api.*url"
```

### Method 5: Test Common Endpoints

Try testing if common endpoints are accessible:

```bash
# Test if it's a decentralized API (should have /v1/chat/completions)
curl -X POST "http://<potential-url>/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"model":"test","messages":[]}'

# Test health endpoint
curl "http://<potential-url>/health"
```

## Common URL Patterns

| Environment | Typical URL Pattern | Notes |
|------------|---------------------|-------|
| **Mainnet** | `https://api.gonka.ai` | Production API |
| **Testnet** | `http://<testnet-domain>:8080` | Common testnet port |
| **Testnet** | `http://<testnet-domain>:30000` | Alternative port |
| **Local Docker** | `http://localhost:8080` | If running locally |
| **Internal Network** | `http://172.18.x.x:8000` | ❌ Not accessible externally |

## Important: Node URL vs Decentralized API URL

### ❌ Node URL (Direct VLLM Endpoint)
```
http://xj7-5.s.filfox.io:19254
```
- This is a **node's VLLM endpoint**
- Direct inference requests (don't count on-chain)
- Requires node-specific authentication
- **NOT what gonka-openai needs**

### ✅ Decentralized API URL
```
https://api.gonka.ai
http://testnet-api.gonka.ai:8080
```
- This is the **gateway API**
- Accepts signed requests
- Routes to nodes
- Records on-chain transactions
- **This is what gonka-openai needs**

## Quick Test Script

Create a test script to find the correct URL:

```python
#!/usr/bin/env python3
"""Test different potential API URLs"""

import requests
from gonka_openai import GonkaOpenAI
import os

# Potential URLs to test
POTENTIAL_URLS = [
    "https://api.gonka.ai",
    "http://localhost:8080",
    "http://xj7-5.s.filfox.io:19254",  # Probably wrong (node URL)
    # Add your testnet URLs here
]

private_key = os.getenv("GONKA_PRIVATE_KEY")
if not private_key:
    print("ERROR: GONKA_PRIVATE_KEY not set")
    exit(1)

# Remove 0x prefix
if private_key.startswith("0x"):
    private_key = private_key[2:]

print("Testing potential API URLs...\n")

for url in POTENTIAL_URLS:
    print(f"Testing: {url}")
    try:
        # Test basic connectivity
        response = requests.get(f"{url}/health", timeout=5)
        print(f"  ✅ Health check: {response.status_code}")
        
        # Try creating client
        client = GonkaOpenAI(
            gonka_private_key=private_key,
            source_url=url
        )
        print(f"  ✅ Client created successfully")
        print(f"  ✅ This URL works! Use: {url}\n")
        break
        
    except requests.exceptions.ConnectTimeout:
        print(f"  ❌ Connection timeout\n")
    except requests.exceptions.ConnectionError:
        print(f"  ❌ Connection refused\n")
    except Exception as e:
        print(f"  ⚠️  Error: {e}\n")
```

## For Your Specific Case

Based on your error, `http://172.18.114.104:8000` is an internal Docker IP. You need to:

1. **Find the public/external URL** for your testnet's decentralized API
2. **Check if it's exposed** on a different port or domain
3. **Use that URL** instead

If you're running a local testnet, the decentralized API might be at:
- `http://localhost:8080` (if port is mapped)
- `http://<your-machine-ip>:8080` (if accessible on network)

## Next Steps

1. **Identify your testnet setup**: Are you using a public testnet or local?
2. **Find the decentralized API URL**: Use one of the methods above
3. **Update your script**: Set `GONKA_API_URL` to the correct URL
4. **Test connectivity**: Make sure you can reach it from your machine

```bash
# Set the correct URL
export GONKA_API_URL="<correct-decentralized-api-url>"

# Run your script
python3 setup_client_example.py
```
