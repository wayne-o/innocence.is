# Privacy System Flow Documentation (Innocence-Based)

## 🔵 DEPOSIT FLOW

### 0. Prove Innocence (One-time, valid 30 days)
**User Action**: First-time users must prove they're not sanctioned
**Frontend** → **Proof Service API** (`http://localhost:3003/api/sanctions/check/{address}`)
  - Request: Check if address is sanctioned
  - Response: `{ isSanctioned: false, sanctionsRoot: "0x..." }`

**Frontend** → **Proof Service API** (`http://localhost:3003/api/generate-proof/innocence`)
  - Request: `{ depositor: "0x..." }`
  - Proof Service:
    - Checks sanctions oracle
    - Runs innocence ZK circuit
    - Proves: "This address is NOT on sanctions list"
    - Returns proof bytes

**Frontend** → **Smart Contract** (`HyperliquidPrivacySystemInnocence.sol`)
  - Calls: `proveInnocence(proof, publicValues)`
  - Contract:
    - Verifies ZK proof via SP1 Verifier
    - Marks address as innocent for 30 days
    - Emits `InnocenceProven` event

### 1. User Initiates Deposit (Frontend)
**User Action**: Enters amount, selects asset, clicks "Deposit"
**Frontend** (`PrivateDepositEVM.tsx`):
  - Checks innocence status (must be proven & not expired)
  - Generates random secret & nullifier
  - Creates commitment = `hash(secret, nullifier)`
  - Stores secret locally in browser

### 2. Prepare Deposit
**Frontend** → **Smart Contract** (`HyperliquidPrivacySystemInnocence.sol`)
  - Calls: `prepareDeposit(token, amount)` with ETH/tokens
  - Contract:
    - Verifies innocence proof is valid
    - Accepts ETH/ERC20 tokens
    - Creates pending deposit record

### 3. Complete Deposit with Commitment
**Frontend** → **Smart Contract**
  - Calls: `completeDeposit(commitment)`
  - Contract:
    - Marks commitment as used
    - Completes the deposit
    - Emits `PrivateDeposit` event

### 4. Backend Indexes Deposit
**Backend API** (InnocenceAPI) - Continuously monitoring:
  - Watches for `PrivateDeposit` events
  - Stores: `{ commitment, depositor, timestamp }`
  - Updates local commitment tracking

---

## 🔴 WITHDRAWAL FLOW

### 1. User Initiates Withdrawal
**User Action**: Enters amount, recipient address, clicks "Withdraw"
**Frontend** (`PrivateWithdraw.tsx`):
  - Retrieves stored secret from browser
  - Calculates nullifier hash = `hash(nullifier)`

### 2. Generate Balance Proof
**Frontend** → **Proof Service API** (`http://localhost:3003/api/generate-proof/balance`)
Request:
```json
{
  "secret": "0x...",
  "nullifier": "0x...",
  "balance": 1000000,
  "minBalance": 100000,
  "assetId": 0
}
```

**Proof Service**:
  - Runs balance ZK circuit
  - Proves: "I know the secret for a commitment with sufficient balance"
  - Returns proof bytes

### 3. Execute Withdrawal
**Frontend** → **Smart Contract** (`HyperliquidPrivacySystemInnocence.sol`)
  - Calls: `withdraw(nullifier, recipient, token, amount, balanceProof, publicValues)`
  
**Smart Contract**:
  - Verifies ZK proof
  - Checks nullifier hasn't been used
  - Marks nullifier as used
  - Transfers ETH/tokens to recipient
  - Emits `PrivateWithdraw` event

### 4. Backend Updates State
**Backend API**:
  - Watches for `PrivateWithdraw` events
  - Stores: `{ nullifierHash, amount, recipient }`
  - Updates withdrawal statistics

---

## 🟡 SANCTIONS MONITORING

### Continuous Monitoring
**Sanctions Oracle Service** (`sanctions-oracle.js`):
  - Maintains list of sanctioned addresses
  - Provides API endpoints:
    - `/api/sanctions/check/{address}` - Check if sanctioned
    - `/api/sanctions/root` - Get current merkle root
    - `/api/sanctions/list` - Get all sanctioned addresses

### Updating Sanctions List
**Admin** → **Smart Contract**:
  - Calls: `updateSanctionsRoot(newRoot)`
  - Only sanctions oracle can update
  - All existing innocence proofs remain valid until expiry

---

## 🔧 SERVICE RESPONSIBILITIES

### Frontend (React):
- Innocence proof management
- Secret generation & storage
- User interface
- Transaction building & submission

### Proof Service (Node.js):
- Innocence proof generation
- Balance proof generation
- Circuit execution
- Sanctions oracle integration

### Backend API (.NET):
- Event indexing
- Commitment tracking
- Statistics & monitoring

### Smart Contracts:
- Innocence verification (30-day validity)
- Proof verification
- Asset custody
- Nullifier tracking

### Sanctions Oracle:
- Maintains sanctions list
- Provides real-time checks
- Transparent & auditable

---

## 📋 KEY DIFFERENCES FROM KYC VERSION

| Old (KYC/Compliance) | New (Innocence) |
|---------------------|-----------------|
| Compliance certificates | Simple sanctions check |
| Identity verification | Address verification only |
| Complex authority signatures | Boolean sanctioned/not sanctioned |
| Permanent certification | 30-day innocence validity |
| Hidden compliance data | Transparent sanctions list |

---

## 🚀 DEPLOYMENT CHECKLIST

- [ ] Deploy `HyperliquidPrivacySystemInnocence` contract
- [ ] Start sanctions oracle service
- [ ] Start proof service with innocence endpoints
- [ ] Update frontend to use innocence flow
- [ ] Test with non-sanctioned address
- [ ] Test rejection of sanctioned address
- [ ] Monitor 30-day expiry behavior