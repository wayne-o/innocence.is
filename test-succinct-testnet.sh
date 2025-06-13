#!/bin/bash

echo "Testing Succinct Testnet Setup"
echo "=============================="

# Check if SP1_PRIVATE_KEY is set
if [ -z "$SP1_PRIVATE_KEY" ]; then
    echo "ERROR: SP1_PRIVATE_KEY is not set"
    echo "Please set your whitelisted wallet private key:"
    echo "export SP1_PRIVATE_KEY=your_private_key_here"
    exit 1
fi

# Set testnet environment variables
export SP1_PROVER=network
export PROVER_NETWORK_RPC=https://rpc.testnet.succinct.xyz
export USE_GROTH16=false

echo "Configuration:"
echo "- SP1_PROVER: $SP1_PROVER"
echo "- PROVER_NETWORK_RPC: $PROVER_NETWORK_RPC"
echo "- USE_GROTH16: $USE_GROTH16"
echo "- SP1_PRIVATE_KEY: [REDACTED]"
echo ""

# Build the circuits if not already built
echo "Building circuits..."
cd zk-circuits/innocence-circuits
cargo build --release

# Test with the simplest proof (ownership proof)
echo ""
echo "Testing ownership proof generation on Succinct testnet..."
echo "This may take 1-5 minutes..."
echo ""

cd script
cargo run --release --bin ownership_proof_test -- \
    --secret 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef \
    --nullifier 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890

echo ""
echo "Test complete! Check the output above for any errors."
echo "If successful, you should see a proof generated and saved to ownership_proof.json"