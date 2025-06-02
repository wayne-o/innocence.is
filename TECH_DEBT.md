# Technical Debt & Mainnet Preparation

## Overview
This document tracks technical debt items and requirements for mainnet deployment of the Innocence privacy system.

## Technical Debt Items

### 1. Event-Based Deposit Tracking
**Current State**: Using polling to check if deposits are complete by monitoring balance changes.

**Issues**:
- Inefficient (multiple RPC calls)
- Potential race conditions with concurrent deposits
- Delays in UI updates

**Proposed Solution**:
```javascript
// Listen for DepositPrepared and monitor transfer completion
contract.on("DepositPrepared", (user, token, amount) => {
  if (user === currentUser) {
    startMonitoringTransfer(token, amount);
  }
});
```

### 2. Unique Deposit Identifiers
**Current State**: Deposits tracked per-user, limiting to one pending deposit at a time.

**Issues**:
- Users can't prepare multiple deposits
- No way to correlate specific UI actions with contract state

**Proposed Solution**:
- Add deposit nonce or UUID to `PendingDeposit` struct
- Allow multiple pending deposits per user
- Track deposits by unique ID in frontend

### 3. Robust State Synchronization
**Current State**: Manual balance checking with arbitrary delays.

**Issues**:
- State sync issues between Hyperliquid L1 and contract
- `canCompleteDeposit` sometimes returns false even after successful transfer

**Proposed Solution**:
- Implement retry logic with exponential backoff
- Add contract method to force-refresh balance from precompile
- Consider using Hyperliquid's websocket API for real-time updates

## Mainnet Preparation Checklist

### Smart Contracts

#### High Priority
- [ ] Replace `MockSP1Verifier` with production SP1 verifier contract
- [ ] Remove `alwaysValid` flag and test mode from verifier
- [ ] Audit all require statements and error messages
- [ ] Gas optimization pass on all functions
- [ ] Implement circuit breaker/pause mechanism
- [ ] Add withdrawal limits and timelock for large amounts

#### Security
- [ ] Professional smart contract audit
- [ ] Formal verification of critical functions
- [ ] Bug bounty program setup
- [ ] Multi-sig deployment and admin functions
- [ ] Remove all test/debug functions

#### Configuration
```solidity
// contracts/contracts/HyperliquidPrivacySystemV6.sol
contract HyperliquidPrivacySystemV6 {
    // Mainnet configuration
    address constant MAINNET_SP1_VERIFIER = 0x...; // Real SP1 verifier
    uint256 constant DEPOSIT_TIMEOUT = 30 minutes; // Shorter timeout
    uint256 constant MAX_DEPOSIT_AMOUNT = 1000000 * 10**8; // $1M limit
    
    // Add emergency pause
    bool public paused;
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
}
```

### Frontend

#### High Priority
- [ ] Remove all console.log statements
- [ ] Implement proper error tracking (Sentry/similar)
- [ ] Add transaction retry logic with user notification
- [ ] Implement proper loading states and timeouts
- [ ] Add mainnet/testnet network detection and switching

#### User Experience
- [ ] Clear error messages for all failure cases
- [ ] Transaction status tracking with detailed steps
- [ ] Estimated time for each operation
- [ ] Help documentation and tooltips
- [ ] Mobile responsive design

#### Security
- [ ] Content Security Policy headers
- [ ] Subresource Integrity for all external scripts
- [ ] Input validation and sanitization
- [ ] Rate limiting on API calls

### Backend Services

#### API Service
- [ ] Production-grade logging (no PII)
- [ ] Rate limiting per address
- [ ] DDoS protection
- [ ] Database connection pooling
- [ ] Horizontal scaling capability

#### Proof Service
- [ ] High availability setup (multiple instances)
- [ ] Proof generation queue with Redis/similar
- [ ] Monitoring and alerting
- [ ] Backup proof generation nodes
- [ ] Circuit update mechanism

### Infrastructure

#### Deployment
- [ ] CI/CD pipeline with automated testing
- [ ] Staging environment matching mainnet
- [ ] Rollback procedures
- [ ] Database backup strategy
- [ ] Disaster recovery plan

#### Monitoring
- [ ] Contract event monitoring
- [ ] Balance tracking alerts
- [ ] Proof generation success rate
- [ ] API response times
- [ ] User deposit/withdrawal flows

### Compliance & Legal

- [ ] Terms of Service
- [ ] Privacy Policy (already exists)
- [ ] Compliance certificate verification process
- [ ] KYC/AML integration points
- [ ] Jurisdiction restrictions

## Migration Plan

### Phase 1: Testnet Hardening (Current)
- Complete all technical debt items
- Extensive testing with real users
- Bug fixes and optimizations

### Phase 2: Mainnet Beta
- Deploy contracts with conservative limits
- Whitelist early users
- Monitor all operations closely
- Gradual limit increases

### Phase 3: General Availability
- Remove whitelist
- Full feature set enabled
- 24/7 monitoring and support

## Risk Mitigation

### Smart Contract Risks
- **Risk**: Funds locked in contract
- **Mitigation**: Time-locked emergency withdrawal function

### Operational Risks
- **Risk**: Proof service downtime
- **Mitigation**: Multiple redundant proof generation nodes

### Regulatory Risks
- **Risk**: Compliance requirements change
- **Mitigation**: Modular compliance system, upgradeable contracts

## Estimated Timeline

- Technical Debt Resolution: 2-3 weeks
- Security Audit: 4-6 weeks
- Mainnet Beta: 2 weeks after audit
- General Availability: 4 weeks after beta

## Next Steps

1. Prioritize technical debt items by risk/impact
2. Begin security audit process
3. Set up mainnet infrastructure
4. Create detailed migration runbook
5. Establish on-call rotation for mainnet support