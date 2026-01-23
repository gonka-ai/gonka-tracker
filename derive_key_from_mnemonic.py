#!/usr/bin/env python3
"""
Derive private key from mnemonic phrase for Gonka
"""

import sys

try:
    from mnemonic import Mnemonic
    from eth_account import Account
except ImportError:
    print("ERROR: Required packages not installed!")
    print("\nInstall them with:")
    print("  pip install mnemonic eth-account")
    sys.exit(1)

# Your mnemonic phrase (from mnemonic.pass.txt)
MNEMONIC = "fat charge sentence power daughter hope ability amazing gorilla couch scatter item soldier game like merit jaguar dream found jacket borrow humor voyage method"

def derive_private_key(mnemonic_phrase: str) -> str:
    """
    Derive ECDSA private key from mnemonic phrase.
    Returns hex-encoded private key (64 characters).
    """
    # Validate mnemonic
    mnemo = Mnemonic("english")
    if not mnemo.check(mnemonic_phrase):
        raise ValueError("Invalid mnemonic phrase")
    
    # Enable HD wallet features
    Account.enable_unaudited_hdwallet_features()
    
    # Derive account from mnemonic (using default derivation path)
    account = Account.from_mnemonic(mnemonic_phrase)
    
    # Get private key as hex (64 characters, no 0x prefix)
    private_key_hex = account.key.hex()
    
    return private_key_hex

if __name__ == "__main__":
    try:
        private_key = derive_private_key(MNEMONIC)
        
        print("=" * 70)
        print("PRIVATE KEY (HEX FORMAT)")
        print("=" * 70)
        print()
        print(f"Private Key: {private_key}")
        print()
        print("=" * 70)
        print("SET AS ENVIRONMENT VARIABLE")
        print("=" * 70)
        print()
        print(f'export GONKA_PRIVATE_KEY="{private_key}"')
        print()
        print("Or with 0x prefix:")
        print(f'export GONKA_PRIVATE_KEY="0x{private_key}"')
        print()
        print("=" * 70)
        print("VERIFICATION")
        print("=" * 70)
        print()
        print(f"Key length: {len(private_key)} characters")
        print(f"Is hex: {all(c in '0123456789abcdef' for c in private_key)}")
        print()
        print("✅ Private key is ready to use with gonka-openai!")
        print()
        
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
