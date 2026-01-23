# Fixing RIPEMD160 Error

The error "unsupported hash type ripemd160" occurs because OpenSSL 3.0+ disabled RIPEMD160 by default. Gonka addresses require RIPEMD160 for derivation (SHA256 → RIPEMD160 → bech32).

## Solution 1: Install pycryptodome (Recommended)

```bash
pip3 install pycryptodome
```

This provides RIPEMD160 support that Python's hashlib can use.

## Solution 2: Install hashlib-compat

```bash
pip3 install hashlib-compat
```

## Solution 3: Use inferenced to get the correct address

Instead of letting the SDK derive the address, get it from inferenced:

```bash
# Get your address from the key
inferenced keys show my-dev-account --address --keyring-backend test
```

Then manually specify it in the client (if the SDK supports it).

## Solution 4: Check gonka-openai version

Update to the latest version:

```bash
pip3 install --upgrade gonka-openai
```

## Solution 5: Enable RIPEMD160 in OpenSSL (System-level)

If you have system access:

```bash
# Check OpenSSL version
openssl version

# For OpenSSL 3.0+, you may need to enable legacy providers
# This is system-dependent and may require root access
```

## Quick Fix

Try this first:

```bash
pip3 install pycryptodome
python3 setup_client_example.py
```

The `pycryptodome` package provides RIPEMD160 support that should work with gonka-openai.
