# Succinct Testnet Setup Guide

## Prerequisites
- Whitelisted wallet for Succinct testnet
- Private key for the whitelisted wallet

## Configuration Steps

### 1. Update Proof Service Environment Variables

Edit `/proof-service/.env` and update the following:

```bash
# Comment out local CPU proving
# USE_GROTH16=false
# SP1_PROVER=cpu

# Enable Succinct testnet proving
USE_GROTH16=false
SP1_PROVER=network
PROVER_NETWORK_RPC=https://rpc.testnet.succinct.xyz
SP1_PRIVATE_KEY=your_whitelisted_wallet_private_key_here
NETWORK_PRIVATE_KEY=your_whitelisted_wallet_private_key_here
```

### 2. Set Circuit Environment Variables

For each circuit execution, you'll need to export these environment variables:

```bash
export SP1_PROVER=network
export PROVER_NETWORK_RPC=https://rpc.testnet.succinct.xyz
export SP1_PRIVATE_KEY=your_whitelisted_wallet_private_key_here
export NETWORK_PRIVATE_KEY=your_whitelisted_wallet_private_key_here
```

### 3. Testing Proof Generation

Test with the balance proof circuit:

```bash
cd zk-circuits/innocence-circuits/script
cargo run --release --bin balance_proof_test
```

### 4. Monitoring Proof Generation

- Proofs will be submitted to Succinct testnet
- Generation time: ~1-5 minutes (vs hours locally)
- Monitor proof status at: https://explorer.testnet.succinct.xyz

## Important Notes

1. **Private Key Security**: Never commit your private key. Use environment variables or `.env` files (which are gitignored).

2. **Testnet Limitations**: 
   - May have rate limits
   - Proofs are not persistent long-term
   - Network may have occasional downtime

3. **Cost**: Testnet proofs are free but require whitelisting

## Switching Between Local and Network Proving

### Local (for development):
```bash
export SP1_PROVER=cpu
export USE_GROTH16=false
```

### Testnet (for testing):
```bash
export SP1_PROVER=network
export PROVER_NETWORK_RPC=https://rpc.testnet.succinct.xyz
export SP1_PRIVATE_KEY=your_key_here
```

## Troubleshooting

1. **"Unauthorized" errors**: Ensure your wallet is whitelisted
2. **Slow proof generation**: Check testnet status
3. **Failed proofs**: Verify your circuit constraints are valid

## Next Steps

1. Update all circuit test scripts to support network proving
2. Add proof status monitoring to the proof service
3. Implement retry logic for network failures