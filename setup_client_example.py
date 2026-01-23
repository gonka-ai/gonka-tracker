#!/usr/bin/env python3
"""
Example: How to set up GonkaOpenAI client
"""

from gonka_openai import GonkaOpenAI
import os
import subprocess
import sys

# Step 1: Get your private key
# The private key MUST be in HEX format (64 hex characters), not base64!
# 
# To export your private key in the correct format:
#   inferenced keys export <key-name> --unarmored-hex --unsafe --keyring-backend test
#
# Or set it via environment variable:
#   export GONKA_PRIVATE_KEY="0x1234567890abcdef..."  # 64 hex chars

PRIVATE_KEY = os.getenv("GONKA_PRIVATE_KEY", "0xc9db1cb9ec3f247323a954322305926b10963eabc5e085f62af95eeab276a881")

if not PRIVATE_KEY:
    print("ERROR: GONKA_PRIVATE_KEY environment variable not set!")
    print("\nTo get your private key, run:")
    print("  inferenced keys export <key-name> --unarmored-hex --unsafe --keyring-backend test")
    print("\nThen set it:")
    print("  export GONKA_PRIVATE_KEY=\"<hex-key>\"")
    sys.exit(1)

# Remove 0x prefix if present (gonka-openai handles both)
if PRIVATE_KEY.startswith("0x"):
    PRIVATE_KEY = PRIVATE_KEY[2:]

# Validate it's hex
if not all(c in '0123456789abcdefABCDEF' for c in PRIVATE_KEY):
    print(f"ERROR: Private key contains non-hex characters!")
    print(f"Key format: {PRIVATE_KEY[:20]}...")
    print("\nThe private key must be hex-encoded (64 hex characters).")
    print("You may have a base64 public key instead. Export the private key:")
    print("  inferenced keys export <key-name> --unarmored-hex --unsafe")
    sys.exit(1)

if len(PRIVATE_KEY) != 64:
    print(f"ERROR: Private key should be 64 hex characters, got {len(PRIVATE_KEY)}")
    sys.exit(1)

# Step 2: Get your decentralized API URL (not node URL!)
# Based on your testnet setup:
# - Internal Docker IP: 172.18.114.104:8000
# - External/public URL: http://xj7-5.s.filfox.io:19254
SOURCE_URL = os.getenv("GONKA_API_URL", "http://172.18.114.104:8000")

# Step 3: Create the client
client = GonkaOpenAI(
    gonka_private_key=PRIVATE_KEY,
    source_url=SOURCE_URL
)

# Step 4: Make a request (this will count towards stats!)
response = client.chat.completions.create(
    model="Qwen/Qwen2.5-7B-Instruct",
    messages=[{"role": "user", "content": "Hello!"}],
    max_tokens=50
)

print(response.choices[0].message.content)
