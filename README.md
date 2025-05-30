# Hyperliquid Privacy System - Private DeFi with Native HyperCore Integration

A revolutionary privacy system that brings complete anonymity to DeFi trading on Hyperliquid, with direct integration to HyperCore order books through native precompiles. Trade spot and perpetuals privately while maintaining full regulatory compliance.

## 🚀 Key Features

- **Native HyperCore Integration**: Direct access to Hyperliquid's high-performance order books via precompiles
- **Complete Privacy**: ZK-proof based system ensuring transaction privacy
- **Regulatory Compliance**: Centralized certificate issuance with decentralized privacy
- **Multi-Asset Support**: Trade any HyperCore spot or perpetual asset privately
- **No Oracle Risk**: Prices fed directly from HyperCore precompiles
- **Atomic Execution**: All trades execute at best available prices on HyperCore

## 🏗️ Architecture

### Smart Contracts (Solidity)
- `HyperliquidPrivacySystem.sol`: Main privacy pool contract with precompile integration
- Direct integration with HyperCore read/write precompiles
- Merkle tree-based commitment scheme
- ZK proof verification (SP1-based)

### Backend API (C# / ASP.NET Core)
- Compliance certificate issuance service
- HyperCore asset validation and price feeds
- Sanction list checking
- Certificate management with cryptographic signatures

### Frontend (React/TypeScript)
- User-friendly interface for deposits, trades, and withdrawals
- Real-time HyperCore asset selector
- Wallet integration (MetaMask, etc.)
- Private portfolio management

### ZK Circuits (SP1)
- Ownership proofs
- Withdrawal proofs  
- Certificate verification

## 🛠️ Tech Stack

- **Blockchain**: HyperEVM (Hyperliquid's EVM)
- **Smart Contracts**: Solidity 0.8.19
- **Backend**: ASP.NET Core 8.0, Entity Framework Core
- **Frontend**: React 18, TypeScript, Ethers.js v6
- **ZK Proofs**: SP1 (Succinct's zkVM)
- **Development**: Hardhat, .NET 8.0, Node.js

## 📋 Prerequisites

- Node.js 18+ and npm
- .NET 8.0 SDK
- Git
- MetaMask or compatible Web3 wallet
- (Optional) SP1 for ZK circuit development

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/wayne-o/innocence.git
cd innocence
```

### 2. Backend Setup
```bash
cd backend/InnocenceAPI
dotnet restore
dotnet build
dotnet run
```
The API will start on http://localhost:5169

### 3. Smart Contract Deployment
```bash
cd contracts
npm install
cp .env.example .env
# Edit .env with your private key
npx hardhat compile
npx hardhat run scripts/deploy.js --network hyperevm_testnet
```

### 4. Frontend Setup
```bash
cd frontend/innocence-ui
npm install
cp .env.example .env
# Edit .env with contract address and API URL
npm start
```
The frontend will start on http://localhost:3000

## 📚 Usage

### Depositing Funds
1. Connect your wallet
2. Select a HyperCore asset
3. Enter amount and a secret phrase
4. Approve compliance check
5. Confirm transaction

### Private Trading
1. Use your commitment from deposit
2. Select trading pair
3. Generate ZK proof
4. Execute trade atomically on HyperCore

### Withdrawing Funds
1. Enter your secret and nullifier
2. Generate withdrawal proof
3. Specify recipient address
4. Complete withdrawal

## 🔐 Security Considerations

- Never share your deposit secrets
- Store nullifiers securely
- Verify contract addresses
- Use hardware wallets for large amounts
- Check compliance certificate validity

## 📊 HyperCore Precompiles

The system leverages Hyperliquid's native precompiles:

### Read Precompiles (0x0800+)
- Oracle prices
- Spot balances
- Vault equity
- Perps positions

### Write System Contract (0x3333...3333)
- IOC orders
- Spot transfers
- Vault operations
- Position management

## 🧪 Testing

```bash
# Smart contract tests
cd contracts && npx hardhat test

# Backend tests
cd backend/InnocenceAPI && dotnet test

# Frontend tests
cd frontend/innocence-ui && npm test
```

## 🚀 Deployment

### Mainnet Deployment Checklist
- [ ] Audit smart contracts
- [ ] Set production compliance authority
- [ ] Configure production RPC endpoints
- [ ] Set up monitoring and logging
- [ ] Enable rate limiting on API
- [ ] Configure CORS policies
- [ ] Set up SSL certificates

## 📈 Performance

- **Transaction Speed**: < 1 second (HyperCore native)
- **Proof Generation**: ~2-5 seconds (client-side)
- **Gas Costs**: Optimized for HyperEVM
- **Throughput**: Limited only by HyperCore capacity

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Hyperliquid team for the precompile architecture
- SP1 team for the zkVM framework
- OpenZeppelin for secure contract patterns

## ⚠️ Disclaimer

This is experimental software. Use at your own risk. Always verify transactions and never invest more than you can afford to lose.