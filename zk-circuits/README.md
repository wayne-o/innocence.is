# ZK Circuits for Hyperliquid Privacy System

This directory contains the zero-knowledge proof circuits for the privacy system using SP1 (Succinct's zkVM).

## Overview

The privacy system uses ZK proofs for:
1. **Ownership Proofs**: Prove ownership of a commitment without revealing the commitment
2. **Withdrawal Proofs**: Prove the right to withdraw funds without linking to deposits
3. **Certificate Verification**: Prove compliance without revealing personal information

## Structure

```
zk-circuits/
├── src/                    # Rust source code for ZK programs
│   ├── ownership/         # Ownership proof circuit
│   ├── withdrawal/        # Withdrawal proof circuit
│   └── certificate/       # Certificate verification circuit
├── programs/              # Compiled SP1 programs
└── tests/                 # Circuit tests
```

## Setup

1. Install SP1:
```bash
curl -L https://sp1.succinct.xyz | bash
sp1up
```

2. Build the circuits:
```bash
cd programs/ownership && cargo prove build
cd programs/withdrawal && cargo prove build
cd programs/certificate && cargo prove build
```

## Usage

The circuits are designed to be called from the smart contracts and frontend:

### Ownership Proof
Proves that a user owns a specific commitment in the privacy pool.

**Public Inputs:**
- Commitment hash
- Merkle root

**Private Inputs:**
- Secret preimage
- Merkle path

### Withdrawal Proof
Proves the right to withdraw funds without revealing which deposit is being withdrawn.

**Public Inputs:**
- Nullifier
- Asset ID
- Amount
- Merkle root

**Private Inputs:**
- Commitment preimage
- Merkle path

### Certificate Verification
Verifies compliance certificates without revealing user data.

**Public Inputs:**
- Certificate hash
- Validity timestamp

**Private Inputs:**
- User address
- Certificate details

## Integration

The proofs are generated client-side and verified on-chain:

1. Frontend generates proof using SP1 SDK
2. Proof is submitted to smart contract
3. Smart contract verifies proof using SP1 verifier

## Security Notes

- Never reuse nullifiers
- Keep preimages secret
- Use secure randomness for commitments
- Verify merkle roots on-chain