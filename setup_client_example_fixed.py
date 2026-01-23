#!/usr/bin/env python3
"""
Example: How to set up GonkaOpenAI client (with RIPEMD160 fix)
"""

# IMPORTANT: Import the fix BEFORE gonka_openai
import sys
import os

# Add the fix for hashlib RIPEMD160 support
# This patches hashlib to use pycryptodome's RIPEMD160
try:
    from Crypto.Hash import RIPEMD160 as CryptoRIPEMD160
    import hashlib
    
    class RIPEMD160:
        def __init__(self, data=b''):
            self._hash = CryptoRIPEMD160.new()
            if data:
                self.update(data)
        
        def update(self, data):
            self._hash.update(data)
            return self
        
        def digest(self):
            return self._hash.digest()
        
        def hexdigest(self):
            return self._hash.hexdigest()
        
        def copy(self):
            new = RIPEMD160()
            new._hash = self._hash.copy()
            return new
    
    # Patch hashlib
    hashlib.ripemd160 = RIPEMD160
    
    # Also patch hashlib.new to support 'ripemd160'
    original_new = hashlib.new
    def new_patched(algorithm, data=b''):
        if algorithm == 'ripemd160':
            return RIPEMD160(data)
        return original_new(algorithm, data)
    hashlib.new = new_patched
    
    print("✅ Patched hashlib for RIPEMD160 support")
except ImportError:
    print("⚠️  Warning: pycryptodome not found. Install with: pip3 install pycryptodome")
    print("   Address derivation may fail.")
except Exception as e:
    print(f"⚠️  Warning: Could not patch hashlib: {e}")

# NOW import gonka_openai (after patching)
from gonka_openai import GonkaOpenAI

# Step 1: Get your private key
PRIVATE_KEY = os.getenv("GONKA_PRIVATE_KEY", "68cbadc39981bc73e9bfe723b204ee0464249bd98ff5a9d5e374bd9369ea6508")

if not PRIVATE_KEY:
    print("ERROR: GONKA_PRIVATE_KEY environment variable not set!")
    sys.exit(1)

# Remove 0x prefix if present
if PRIVATE_KEY.startswith("0x"):
    PRIVATE_KEY = PRIVATE_KEY[2:]

# Validate it's hex
if not all(c in '0123456789abcdefABCDEF' for c in PRIVATE_KEY):
    print(f"ERROR: Private key contains non-hex characters!")
    sys.exit(1)

if len(PRIVATE_KEY) != 64:
    print(f"ERROR: Private key should be 64 hex characters, got {len(PRIVATE_KEY)}")
    sys.exit(1)

# Step 2: Get your decentralized API URL
SOURCE_URL = os.getenv("GONKA_API_URL", "http://172.18.114.103:8000")

# Step 3: Create the client
print(f"\nCreating client with:")
print(f"  Source URL: {SOURCE_URL}")
print(f"  Private key: {PRIVATE_KEY[:20]}...")

client = GonkaOpenAI(
    gonka_private_key=PRIVATE_KEY,
    source_url=SOURCE_URL
)

# Step 4: Make a request
print("\nMaking inference request...")
try:
    response = client.chat.completions.create(
        model="Qwen/Qwen2.5-7B-Instruct",
        messages=[{"role": "user", "content": "Hello!"}],
        max_tokens=50
    )
    
    print("\n✅ Success!")
    print(f"Response: {response.choices[0].message.content}")
except Exception as e:
    print(f"\n❌ Error: {e}")
    print("\nTroubleshooting:")
    print("1. Check if the API URL is correct")
    print("2. Verify the private key is correct")
    print("3. Check if the testnet has restrictions (block height)")
    print("4. Verify RIPEMD160 patch worked (check for address derivation warning)")
