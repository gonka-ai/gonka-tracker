# How to Export Private Key in Correct Format

The error you're seeing is because the private key format is incorrect. `gonka-openai` requires a **hex-encoded private key**, not base64.

## The Problem

Your current key looks like base64:
```
A3c9Uvocrk3bl8r+wuDf1yuGZxN02iu660yiSGusOSTv
```

But `gonka-openai` needs hex format:
```
0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

## Solution: Export Private Key in Hex Format

### Method 1: Using `inferenced keys export` (Recommended)

```bash
# Export private key in hex format (unarmored = no PEM wrapper)
inferenced keys export <your-key-name> --unarmored-hex --unsafe --keyring-backend test

# This will output a 64-character hex string like:
# 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

**Example:**
```bash
# List your keys first
inferenced keys list --keyring-backend test

# Export a specific key
inferenced keys export my-dev-account --unarmored-hex --unsafe --keyring-backend test

# Output will be something like:
# a3c9uvocrk3bl8rwudf1yugzxn02iu660yisgusostv1234567890abcdef1234567890abcdef
```

### Method 2: From Node Container

If your key is in a node container:

```bash
# Access container
docker exec -it <node-container> /bin/sh

# Export key
inferenced keys export <key-name> --unarmored-hex --unsafe --keyring-backend test --keyring-dir /root/.inference
```

### Method 3: Convert from Mnemonic (If You Have It)

If you have the mnemonic phrase:

```python
from mnemonic import Mnemonic
from eth_account import Account

mnemonic = "your twelve word mnemonic phrase here"
Account.enable_unaudited_hdwallet_features()
account = Account.from_mnemonic(mnemonic)
private_key_hex = account.key.hex()  # This is your hex private key (64 chars)
print(private_key_hex)
```

## Using the Exported Key

Once you have the hex key:

```bash
# Set as environment variable
export GONKA_PRIVATE_KEY="1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

# Or with 0x prefix (both work)
export GONKA_PRIVATE_KEY="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
```

Then use it in Python:

```python
from gonka_openai import GonkaOpenAI
import os

# Get from environment
private_key = os.getenv("GONKA_PRIVATE_KEY")

# Remove 0x prefix if present
if private_key.startswith("0x"):
    private_key = private_key[2:]

# Validate it's 64 hex characters
if len(private_key) != 64 or not all(c in '0123456789abcdefABCDEF' for c in private_key):
    raise ValueError("Invalid private key format - must be 64 hex characters")

client = GonkaOpenAI(
    gonka_private_key=private_key,  # or with 0x prefix, both work
    source_url="https://api.gonka.ai"
)
```

## Key Format Comparison

| Format | Example | Valid for gonka-openai? |
|--------|---------|-------------------------|
| **Hex (64 chars)** | `1234567890abcdef...` | ✅ Yes |
| **Hex with 0x** | `0x1234567890abcdef...` | ✅ Yes |
| **Base64** | `A3c9Uvocrk3bl8r+wuDf...` | ❌ No |
| **PEM** | `-----BEGIN PRIVATE KEY-----...` | ❌ No |
| **Public Key** | `AueT4ZgGOzdZemlpqjAwfmwN2WAvEPhsBNbfbhUNNhGp` | ❌ No (this is public) |

## Common Mistakes

### Mistake 1: Using Public Key Instead of Private Key

**Wrong:**
```python
# This is a PUBLIC KEY (base64), not private!
PRIVATE_KEY = "AueT4ZgGOzdZemlpqjAwfmwN2WAvEPhsBNbfbhUNNhGp"
```

**Correct:**
```python
# This is a PRIVATE KEY (hex)
PRIVATE_KEY = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
```

### Mistake 2: Using Base64 Instead of Hex

**Wrong:**
```python
PRIVATE_KEY = "A3c9Uvocrk3bl8r+wuDf1yuGZxN02iu660yiSGusOSTv"  # Base64
```

**Correct:**
```python
PRIVATE_KEY = "a3c9uvocrk3bl8rwudf1yugzxn02iu660yisgusostv1234567890abcdef1234567890abcdef"  # Hex
```

## Quick Check Script

```python
#!/usr/bin/env python3
import os

key = os.getenv("GONKA_PRIVATE_KEY", "")

# Remove 0x prefix
if key.startswith("0x"):
    key = key[2:]

print(f"Key length: {len(key)}")
print(f"Is hex: {all(c in '0123456789abcdefABCDEF' for c in key)}")
print(f"First 20 chars: {key[:20]}...")

if len(key) == 64 and all(c in '0123456789abcdefABCDEF' for c in key):
    print("✅ Key format is correct!")
else:
    print("❌ Key format is incorrect!")
    print("Expected: 64 hex characters")
    print("Run: inferenced keys export <key-name> --unarmored-hex --unsafe")
```

## Complete Working Example

```python
#!/usr/bin/env python3
from gonka_openai import GonkaOpenAI
import os

# Get private key from environment
private_key = os.getenv("GONKA_PRIVATE_KEY")
if not private_key:
    raise ValueError("GONKA_PRIVATE_KEY not set")

# Remove 0x prefix if present
if private_key.startswith("0x"):
    private_key = private_key[2:]

# Validate format
if len(private_key) != 64:
    raise ValueError(f"Private key must be 64 hex characters, got {len(private_key)}")

if not all(c in '0123456789abcdefABCDEF' for c in private_key):
    raise ValueError("Private key contains non-hex characters")

# Create client
client = GonkaOpenAI(
    gonka_private_key=private_key,  # or "0x" + private_key
    source_url="https://api.gonka.ai"  # Your decentralized API URL
)

# Make request
response = client.chat.completions.create(
    model="Qwen/Qwen2.5-7B-Instruct",
    messages=[{"role": "user", "content": "Hello!"}],
    max_tokens=50
)

print(response.choices[0].message.content)
```

## Summary

1. **Export your private key in hex format:**
   ```bash
   inferenced keys export <key-name> --unarmored-hex --unsafe --keyring-backend test
   ```

2. **Set it as environment variable:**
   ```bash
   export GONKA_PRIVATE_KEY="<64-hex-characters>"
   ```

3. **Use in Python:**
   ```python
   client = GonkaOpenAI(
       gonka_private_key=os.getenv("GONKA_PRIVATE_KEY"),
       source_url="https://api.gonka.ai"
   )
   ```

The key must be **64 hex characters** (with or without `0x` prefix), not base64!
