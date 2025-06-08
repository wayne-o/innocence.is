#!/bin/bash

echo "🚀 Deploying Real SP1 Verifier to Hyperliquid Testnet..."

cd sp1-contracts/contracts

# Build contracts
echo "Building contracts..."
forge build

# Deploy SP1VerifierGroth16 with broadcast
echo "Deploying SP1VerifierGroth16..."
forge create \
  --rpc-url https://rpc.hyperliquid-testnet.xyz/evm \
  --private-key $PRIVATE_KEY \
  --legacy \
  --broadcast \
  src/v5.0.0/SP1VerifierGroth16.sol:SP1Verifier

echo "✅ Deployment complete!"