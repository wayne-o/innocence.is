# Proof Mode Switching Guide

## Current Setup: MOCK MODE (Testing)
- Fast proof generation (~10 seconds)
- Uses Core proofs with MockSP1Verifier
- Perfect for development and testing

## To Switch Between Modes:

### Testing Mode (Current)
1. **Proof Service Configuration** (`proof-service/.env`):
   ```
   USE_GROTH16=false
   SP1_PROVER=cpu
   ```

2. **Deploy Mock Contracts**:
   ```bash
   cd contracts
   npx hardhat run scripts/deploy-with-mock-verifier.js --network hyperevm_testnet
   ```

3. **Restart Proof Service**:
   ```bash
   cd proof-service
   ./restart.sh
   ```

### Production Mode
1. **Proof Service Configuration** (`proof-service/.env`):
   ```
   USE_GROTH16=true
   SP1_PROVER=cpu
   # OR for Succinct Network:
   # SP1_PROVER=network
   # NETWORK_RPC_URL=https://rpc.production.succinct.xyz
   # NETWORK_PRIVATE_KEY=your_key_here
   ```

2. **Deploy Production Contracts**:
   ```bash
   cd contracts
   npx hardhat run scripts/deploy-production.js --network hyperevm_testnet
   ```

3. **Restart Proof Service**:
   ```bash
   cd proof-service
   ./restart.sh
   ```

## Key Differences:
| Feature | Mock Mode | Production Mode |
|---------|-----------|-----------------|
| Proof Generation | ~10 seconds | 5-10 minutes |
| Verifier Contract | MockSP1Verifier | SP1VerifierGroth16 |
| Security | Testing only | Production ready |
| Cost | Minimal | Higher (CPU/Network) |

## Contract Addresses Will Be Updated Automatically
The deployment scripts automatically update `frontend/innocence-ui/src/config/networks.ts`