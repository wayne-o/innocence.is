# Innocence Protocol - Zero-Knowledge Integration

## 🎯 Overview

The Innocence Protocol now features complete zero-knowledge proof integration, enabling fully private trading on Hyperliquid. All operations are protected by SP1 ZK proofs, ensuring complete privacy while maintaining compliance.

## 🏗️ Architecture

### ZK Circuits (SP1)
- **Ownership Proof**: Proves commitment ownership without revealing secrets
- **Balance Proof**: Proves sufficient balance with merkle tree inclusion
- **Trade Proof**: Proves valid trade parameters without revealing balances
- **Compliance Proof**: Proves KYC compliance without revealing identity

### Smart Contracts
- **HyperliquidPrivacySystemV4**: Main contract with SP1 verifier integration
- **MockSP1Verifier**: Test verifier for development
- **InnocenceVerificationKeys**: On-chain verification keys

### Services
- **Proof Service API**: REST API for proof generation
- **Frontend Integration**: React components with ZK proof support

## 🚀 Getting Started

### 1. Start the Proof Service
```bash
cd proof-service
npm install
npm start
```

### 2. Build ZK Circuits
```bash
cd zk-circuits/innocence-circuits
cargo build --release
```

### 3. Run Frontend
```bash
cd frontend/innocence-ui
npm install
npm start
```

## 📝 Contract Addresses (Testnet)

- **Privacy System V4**: `0xAa8289Bd8754064335D47c22d02caD493E166e8b`
- **SP1 Verifier**: `0x3B6041173B80E77f038f3F2C0f9744f04837185e`

## 🔐 Verification Keys

```solidity
OWNERSHIP_VKEY: 0x006bf06179a19e1575731cbb10c5b9cc955cae6f0a5de98cf8baf3c7c416131a
BALANCE_VKEY:   0x009c22b4f95fb710070dc80cfce7526c4cc7780834ab328bd769ff58934e6d05
COMPLIANCE_VKEY: 0x00ed1611619b8f2866de7be17d81a9d42a869b4c5959629708f125ae34a2f9ee
TRADE_VKEY:     0x008484840d42565b9589f5c37253789d3731407964b1537fb5cf9d6064226b1c
```

## 🎮 Demo Flow

### 1. Private Deposit
```javascript
// User generates random secret and nullifier
const secret = generateSecret();
const nullifier = generateNullifier();

// Generate compliance proof
const { commitment, proofBytes, publicValues } = await generateDepositProof(secret, nullifier);

// Execute deposit with ZK proof
await privacySystem.deposit(commitment, token, amount, proofBytes, publicValues);
```

### 2. Private Trade
```javascript
// Generate trade proof
const { proofBytes, publicValues } = await generateTradeProof(
  commitment, fromAsset, toAsset, fromAmount, minToAmount
);

// Execute trade
await privacySystem.privateSpotTrade(proofBytes, publicValues);
```

### 3. Private Withdrawal
```javascript
// Generate balance proof
const { nullifier, proofBytes, publicValues } = await generateWithdrawalProof(
  commitment, token, amount, merkleRoot
);

// Execute withdrawal
await privacySystem.withdraw(nullifier, recipient, token, amount, proofBytes, publicValues);
```

## 🧪 Testing

### Generate Test Proofs
```bash
cd zk-circuits/innocence-circuits

# Ownership proof
./target/release/ownership-proof --execute

# Balance proof
./target/release/balance-proof --execute --balance 1000 --min-balance 100

# Trade proof
./target/release/trade-proof --execute --from-balance 1000 --from-amount 100

# Compliance proof
./target/release/compliance-proof --execute --valid-days 365
```

### Run Demo Script
```bash
node demo-private-trading.js
```

## 🔍 Proof Generation Details

### Ownership Proof
- **Private inputs**: secret, nullifier
- **Public outputs**: commitment, nullifierHash
- **Verification**: commitment = hash(secret || nullifier)

### Balance Proof
- **Private inputs**: secret, nullifier, balance, merkle_proof
- **Public outputs**: commitment, merkleRoot, minBalance, assetId
- **Verification**: balance >= minBalance AND merkle proof validity

### Trade Proof
- **Private inputs**: secret, nullifier, fromBalance, toBalance
- **Public outputs**: commitment, fromAsset, toAsset, fromAmount, minToAmount
- **Verification**: fromBalance >= fromAmount AND valid trade parameters

### Compliance Proof
- **Private inputs**: secret, nullifier, certificate_data, signature
- **Public outputs**: commitment, complianceAuthority, validUntil, certificateHash
- **Verification**: Valid certificate AND not expired

## 🛡️ Security Considerations

1. **Secret Management**: Users must securely store their secrets and nullifiers
2. **Proof Generation**: Proofs should be generated client-side when possible
3. **Nullifier Tracking**: Contract prevents double-spending via nullifier tracking
4. **Merkle Tree**: Commitments are stored in on-chain merkle tree for inclusion proofs

## 📊 Performance

- **Proof Generation**: ~5-30 seconds depending on circuit complexity
- **On-chain Verification**: ~300-500k gas per proof verification
- **Circuit Sizes**: 26k-54k cycles (SP1)

## 🚧 Future Improvements

1. **Batch Proofs**: Aggregate multiple operations into single proof
2. **Recursive Proofs**: Prove proof validity for infinite composability
3. **Ring Signatures**: Enhanced anonymity sets
4. **Stealth Addresses**: One-time deposit addresses
5. **Hardware Acceleration**: GPU proof generation

## 📚 Resources

- [SP1 Documentation](https://docs.succinct.xyz/sp1)
- [Hyperliquid Docs](https://docs.hyperliquid.xyz)
- [Contract Source](contracts/contracts/HyperliquidPrivacySystemV4.sol)
- [Circuit Source](zk-circuits/innocence-circuits/)