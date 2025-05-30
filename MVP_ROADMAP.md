# Innocence Protocol - MVP Roadmap

## Current Status ✅
- Smart contracts deployed on testnet with HyperCore precompile integration
- Basic deposit functionality working
- Frontend connected and functional
- Compliance system mocked for testing

## MVP Requirements

### Phase 1: Complete ZK Proof System (2-3 weeks)

#### 1. SP1 Zero-Knowledge Circuits 🔴 HIGH PRIORITY
- [ ] **Ownership Proof Circuit**
  - Prove knowledge of secret and nullifier for a commitment
  - Without revealing the secret
- [ ] **Balance Proof Circuit**  
  - Prove sufficient balance for withdrawal/trade
  - Include merkle tree membership proof
- [ ] **Compliance Proof Circuit**
  - Prove valid KYC without revealing identity
  - Time-bound certificate validation
- [ ] **Trade Proof Circuit**
  - Prove valid trade parameters
  - Ensure no negative balances
- [ ] **Portfolio Proof Circuit**
  - Prove aggregate positions/balances
  - Support multiple assets

#### 2. Proof Generation Infrastructure 🔴 HIGH PRIORITY
- [ ] SP1 SDK integration in frontend
- [ ] Efficient witness generation
- [ ] Proof caching system
- [ ] Fallback to server-side proving if needed
- [ ] Proof size optimization

#### 3. Smart Contract Verification 🔴 HIGH PRIORITY
- [ ] SP1 verifier contract integration
- [ ] On-chain proof verification
- [ ] Gas optimization for verification
- [ ] Batch proof verification support

### Phase 2: Core Functionality with ZK (1-2 weeks)

#### 4. Private Withdrawal 🔴 HIGH PRIORITY
- [ ] Withdrawal UI with proof generation
- [ ] Nullifier management
- [ ] Double-spend prevention
- [ ] Emergency withdrawal mechanism

#### 5. Private Trading 🔴 HIGH PRIORITY
- [ ] **Spot Trading**
  - Asset pair selection with privacy
  - ZK proof of sufficient balance
  - Atomic swap execution
  - Private order matching
- [ ] **Perps Trading**
  - Position proof generation
  - Leverage validation in ZK
  - Private liquidation mechanism
  - Cross-margin support

#### 6. Commitment Management 🟡 MEDIUM PRIORITY
- [ ] Secure commitment storage
- [ ] Multi-device sync (encrypted)
- [ ] Commitment recovery mechanism
- [ ] Hierarchical deterministic commitments

### Phase 3: Advanced Privacy Features (1-2 weeks)

#### 7. Enhanced Privacy 🟡 MEDIUM PRIORITY
- [ ] **Ring Signatures**
  - Hide transaction sender among set
  - Larger anonymity sets
- [ ] **Stealth Addresses**
  - One-time addresses for deposits
  - Enhanced recipient privacy
- [ ] **Private Compliance**
  - Selective disclosure proofs
  - Regulatory reporting without full transparency

#### 8. Portfolio Management 🟡 MEDIUM PRIORITY
- [ ] Private portfolio analytics
- [ ] Risk metrics in ZK
- [ ] P&L calculations with proofs
- [ ] Multi-asset aggregation

### Phase 4: Production Ready (1 week)

#### 9. Security & Optimization 🔴 HIGH PRIORITY
- [ ] Circuit audit preparation
- [ ] Trusted setup ceremony (if needed)
- [ ] Performance benchmarking
- [ ] Security bounty program

#### 10. User Experience 🟡 MEDIUM PRIORITY
- [ ] Proof generation progress UI
- [ ] Estimated proving times
- [ ] Offline proof generation
- [ ] Mobile proof generation support

## Technical Architecture

### ZK Proof Stack
```
SP1 Circuits (Rust)
├── Core Proofs
│   ├── ownership_proof.rs
│   ├── balance_proof.rs
│   ├── trade_proof.rs
│   └── compliance_proof.rs
├── Aggregation Layer
│   └── batch_verifier.rs
└── Helper Circuits
    ├── merkle_proof.rs
    ├── range_proof.rs
    └── signature_proof.rs
```

### Proof Generation Flow
1. User initiates action (withdraw/trade)
2. Frontend generates witness data
3. SP1 prover creates proof
4. Proof submitted to smart contract
5. On-chain verification
6. Action executed if valid

## MVP Definition

**Required features for launch:**
1. Full ZK proof system for ALL operations
2. Private deposits with compliance proofs ✅
3. Private withdrawals with nullifier proofs
4. Private spot trading with balance proofs
5. Private perps trading with position proofs
6. Complete proof verification on-chain
7. 10+ TPS throughput capability

**Performance Targets:**
- Proof generation: <30 seconds
- Verification gas: <500k
- Anonymity set: >100 users
- Circuit security: 128-bit

## Estimated Timeline

- **Week 1-2**: Build complete SP1 circuit suite
- **Week 3**: Integrate proof generation in frontend
- **Week 4**: Implement withdrawal and trading with ZK
- **Week 5**: Advanced privacy features
- **Week 6**: Security audit and optimization
- **Week 7**: Final testing and mainnet prep

Total: ~7 weeks to MVP with full ZK

## Next Immediate Steps

1. Set up SP1 development environment
2. Design circuit architecture
3. Implement ownership proof circuit
4. Create proof generation service
5. Update smart contracts for verification

## Success Metrics

- [ ] ALL operations use real ZK proofs
- [ ] Proof generation <30 seconds
- [ ] No trusted setup required (using SP1)
- [ ] Supports 100+ concurrent users
- [ ] Passes security audit
- [ ] Zero knowledge leakage