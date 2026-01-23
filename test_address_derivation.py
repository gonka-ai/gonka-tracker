#!/usr/bin/env python3
"""
Test address derivation from private key
"""

import os
from eth_account import Account

# Enable HD wallet features
Account.enable_unaudited_hdwallet_features()

# Your private key
PRIVATE_KEY = os.getenv("GONKA_PRIVATE_KEY")

# Remove 0x prefix if present
if PRIVATE_KEY.startswith("0x"):
    PRIVATE_KEY = PRIVATE_KEY[2:]

print(f"Private key (first 20 chars): {PRIVATE_KEY[:20]}...")
print(f"Private key length: {len(PRIVATE_KEY)}")

# Derive Ethereum-style address
try:
    account = Account.from_key("0x" + PRIVATE_KEY)
    eth_address = account.address
    print(f"\nEthereum address: {eth_address}")
except Exception as e:
    print(f"\nError deriving Ethereum address: {e}")

# Try to derive Cosmos/Gonka address
# Gonka uses Cosmos SDK, so addresses are bech32 encoded
try:
    from cosmpy.crypto.address import Address
    from cosmpy.crypto.keypairs import PrivateKey
    
    # This might not work if cosmpy is not installed
    private_key_bytes = bytes.fromhex(PRIVATE_KEY)
    # Gonka uses "gonka" as bech32 prefix
    # This is a simplified check - actual derivation is more complex
    print("\nNote: Gonka addresses use bech32 encoding with 'gonka' prefix")
    print("The SDK should handle this automatically, but there might be a compatibility issue.")
except ImportError:
    print("\ncosmpy not installed - cannot test Cosmos address derivation")
except Exception as e:
    print(f"\nError: {e}")

print("\n" + "="*70)
print("The address derivation issue might be:")
print("1. SDK version incompatibility")
print("2. Missing ripemd160 support in the environment")
print("3. Wrong address format for this testnet")
print("\nTry:")
print("- Update gonka-openai: pip3 install --upgrade gonka-openai")
print("- Check if the address should be manually specified")
print("- Verify the private key is correct for this testnet")
