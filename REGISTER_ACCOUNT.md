# Registering Account on Gonka Chain

The error "account not found: key not found" means your account is not registered on the blockchain/testnet.

## The Issue

Your address `gonka1494qjlgyyu6s6dac7nf24d7nt6vq7rg7h2zd8u` is derived correctly, but it doesn't exist on the chain yet. You need to register it first.

## Solution: Register the Account

### Method 1: Using inferenced CLI (Recommended)

If you have access to the testnet node:

```bash
# 1. Import the key from mnemonic (if not already imported)
inferenced keys add my-dev-account --recover --keyring-backend test

# When prompted, paste your mnemonic:
# fat charge sentence power daughter hope ability amazing gorilla couch scatter item soldier game like merit jaguar dream found jacket borrow humor voyage method

# 2. Get the address
inferenced keys show my-dev-account --address --keyring-backend test

# 3. Register the account on the chain (if there's a registration command)
# This depends on your testnet setup
```

### Method 2: Check if Account Needs Funding

The account might need to be funded first. Check if you need to:

1. **Get testnet tokens** - Some testnets require you to request tokens from a faucet
2. **Create the account** - Some chains auto-create accounts on first transaction

### Method 3: Verify the Address Matches

Your mnemonic file shows address: `gonka1fee0zveeuwd2p9ttvfh0ue0za6623daxf2h6gh`

But the SDK derived: `gonka1494qjlgyyu6s6dac7nf24d7nt6vq7rg7h2zd8u`

These don't match! This suggests:
- The private key in your script might not match the mnemonic
- Or there's a derivation path difference

### Verify Private Key Matches Mnemonic

To verify, export the private key from the mnemonic:

```bash
# Using inferenced
inferenced keys add test-verify --recover --keyring-backend test
# Paste mnemonic when prompted

# Export the private key
inferenced keys export test-verify --unarmored-hex --unsafe --keyring-backend test

# Compare with the private key in your script
```

## Quick Check: Is the Account on Chain?

Check if your account exists on the chain:

```bash
# Using inferenced query
inferenced query bank balances gonka1fee0zveeuwd2p9ttvfh0ue0za6623daxf2h6gh --node http://172.18.114.103:26657

# Or check via API
curl "http://172.18.114.103:26657/abci_query?path=\"/cosmos.auth.v1beta1.Query/Account\"&data=0x$(echo -n 'gonka1fee0zveeuwd2p9ttvfh0ue0za6623daxf2h6gh' | xxd -p)"
```

## If Account Doesn't Exist

1. **Register via testnet faucet** (if available)
2. **Create account via first transaction** - Some chains auto-create on first send
3. **Use a different account** that's already registered
4. **Check testnet documentation** for account creation process

## Address Mismatch Issue

The address from your mnemonic (`gonka1fee0zveeuwd2p9ttvfh0ue0za6623daxf2h6gh`) doesn't match the derived address (`gonka1494qjlgyyu6s6dac7nf24d7nt6vq7rg7h2zd8u`). This means:

- The private key `c9db1cb9ec3f247323a954322305926b10963eabc5e085f62af95eeab276a881` doesn't correspond to the mnemonic
- You need to use the private key that matches the mnemonic

To get the correct private key:

```bash
# Import from mnemonic
inferenced keys add my-dev-account --recover --keyring-backend test

# Export the private key
inferenced keys export my-dev-account --unarmored-hex --unsafe --keyring-backend test

# Use that private key in your script
```

## Next Steps

1. **Verify the private key matches the mnemonic**
2. **Check if the account exists on chain**
3. **Register/fund the account if needed**
4. **Use the correct private key that matches your mnemonic**
