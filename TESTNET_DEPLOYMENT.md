# Hyperliquid Testnet Deployment Guide

## Prerequisites

1. **Private Key**: You need a funded wallet on Hyperliquid testnet
   - Get testnet ETH from the Hyperliquid faucet
   - Never commit your private key!

2. **Node.js**: v16+ installed

3. **MetaMask**: Installed and configured

## Deployment Steps

### 1. Configure Private Key

```bash
cd contracts
# Edit .env file and add your private key
# PRIVATE_KEY=your_private_key_here
```

### 2. Deploy Contracts

```bash
# Install dependencies
npm install

# Deploy to testnet
npx hardhat run scripts/deploy-testnet.js --network hyperevm_testnet
```

This will:
- Deploy the HyperliquidPrivacySystem contract
- Set the deployer as the compliance authority (for testing)
- Save deployment info to `deployments/hyperevm_testnet-deployment.json`

### 3. Update Frontend Configuration

After deployment, update the frontend config:

```bash
cd ../frontend/innocence-ui

# Copy testnet env file
cp .env.testnet .env

# Edit .env and update CONTRACT_ADDRESS with the deployed address
# REACT_APP_CONTRACT_ADDRESS=0x... (from deployment output)
```

### 4. Configure MetaMask

Add Hyperliquid Testnet to MetaMask:
- **Network Name**: Hyperliquid Testnet
- **RPC URL**: https://api.testnet.hyperliquid.xyz/evm
- **Chain ID**: 998
- **Currency Symbol**: ETH

The app will automatically prompt to add the network when connecting.

### 5. Run Frontend

```bash
# Install dependencies
npm install

# Start the app
npm start
```

### 6. Test the System

1. Connect your wallet (it will switch to testnet automatically)
2. Get compliance certificate from the API
3. Deposit funds into the privacy pool
4. Trade and withdraw privately

## Important Notes

- The testnet uses native HyperCore precompiles at:
  - Read: `0x0000000000000000000000000000000000000800`
  - Write: `0x3333333333333333333333333333333333333333`
- No mock contracts are deployed on testnet
- Ensure you have testnet ETH for gas fees

## Troubleshooting

- **"insufficient funds"**: Get testnet ETH from faucet
- **"Contract not deployed"**: Check deployment output and update frontend .env
- **"Network error"**: Ensure MetaMask is on Hyperliquid Testnet (Chain ID: 998)