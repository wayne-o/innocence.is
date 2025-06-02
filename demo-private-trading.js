#!/usr/bin/env node

/**
 * Innocence Protocol - Private Trading Demo
 * 
 * This script demonstrates the full flow of private trading on Hyperliquid
 * using zero-knowledge proofs for complete privacy.
 */

const { ethers } = require('ethers');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Configuration
const RPC_URL = 'https://rpc.hyperliquid-testnet.xyz/evm';
const PRIVACY_SYSTEM_ADDRESS = '0xAa8289Bd8754064335D47c22d02caD493E166e8b';
const CIRCUITS_PATH = './zk-circuits/innocence-circuits';

// Contract ABI
const PRIVACY_SYSTEM_ABI = [
  "function deposit(bytes32 commitment, uint64 token, uint64 amount, bytes calldata complianceProof, bytes calldata publicValues) external",
  "function privateSpotTrade(bytes calldata tradeProof, bytes calldata publicValues) external",
  "function withdraw(bytes32 nullifier, address recipient, uint64 token, uint64 amount, bytes calldata balanceProof, bytes calldata publicValues) external",
  "function getMerkleRoot() external view returns (bytes32)",
  "event PrivateDeposit(bytes32 indexed commitment, uint256 timestamp)",
  "event PrivateTrade(bytes32 indexed commitment, uint256 timestamp)",
  "event PrivateWithdraw(bytes32 indexed nullifier, uint256 timestamp)",
];

// Demo flow
async function main() {
  console.log('🎭 Innocence Protocol - Private Trading Demo\n');
  
  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  // Use environment variable or prompt for private key
  let privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    privateKey = await prompt('Enter your private key: ');
  }
  
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(PRIVACY_SYSTEM_ADDRESS, PRIVACY_SYSTEM_ABI, wallet);
  
  console.log('📍 Connected to:', wallet.address);
  console.log('💰 Balance:', ethers.formatEther(await provider.getBalance(wallet.address)), 'ETH');
  console.log('📄 Privacy System:', PRIVACY_SYSTEM_ADDRESS);
  console.log();

  // Demo steps
  const steps = [
    { title: '1. Generate Secret & Nullifier', fn: generateSecrets },
    { title: '2. Create Private Deposit with ZK Proof', fn: privateDeposit },
    { title: '3. Execute Private Trade', fn: privateTrade },
    { title: '4. Withdraw with Balance Proof', fn: privateWithdraw },
  ];

  let demoData = {
    secret: null,
    nullifier: null,
    commitment: null,
    depositTx: null,
    tradeTx: null,
    withdrawTx: null,
  };

  for (const step of steps) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🔸 ${step.title}`);
    console.log('='.repeat(50) + '\n');
    
    await step.fn(contract, wallet, demoData);
    
    if (step !== steps[steps.length - 1]) {
      await prompt('\nPress Enter to continue...');
    }
  }

  console.log('\n✅ Demo completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`- Commitment: ${demoData.commitment}`);
  console.log(`- Deposit TX: ${demoData.depositTx}`);
  console.log(`- Trade TX: ${demoData.tradeTx}`);
  console.log(`- Withdraw TX: ${demoData.withdrawTx}`);
  
  rl.close();
}

// Step 1: Generate secrets
async function generateSecrets(contract, wallet, data) {
  console.log('Generating cryptographic secrets...\n');
  
  data.secret = ethers.hexlify(ethers.randomBytes(32));
  data.nullifier = ethers.hexlify(ethers.randomBytes(32));
  data.commitment = ethers.keccak256(ethers.concat([data.secret, data.nullifier]));
  
  console.log('🔐 Secret:', data.secret);
  console.log('🔑 Nullifier:', data.nullifier);
  console.log('📝 Commitment:', data.commitment);
  
  // Save to file
  const secretFile = `innocence-secret-${Date.now()}.json`;
  fs.writeFileSync(secretFile, JSON.stringify({
    secret: data.secret,
    nullifier: data.nullifier,
    commitment: data.commitment,
    timestamp: new Date().toISOString()
  }, null, 2));
  
  console.log(`\n💾 Secrets saved to: ${secretFile}`);
  console.log('⚠️  Keep this file safe! You need it to withdraw funds.');
}

// Step 2: Private deposit
async function privateDeposit(contract, wallet, data) {
  console.log('Creating private deposit with compliance proof...\n');
  
  // Generate compliance proof
  console.log('🔄 Generating ZK proof...');
  const proofData = await generateProof('compliance', {
    secret: data.secret,
    nullifier: data.nullifier,
    validDays: 365
  });
  
  console.log('✅ Proof generated!');
  
  // Encode public values
  const publicValues = ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes32', 'address', 'uint256', 'bytes32'],
    [
      data.commitment,
      wallet.address, // Compliance authority (simplified for demo)
      Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
      ethers.keccak256(ethers.toUtf8Bytes('certificate'))
    ]
  );
  
  // Execute deposit
  console.log('\n💸 Depositing 100 USDC privately...');
  const tx = await contract.deposit(
    data.commitment,
    0, // USDC token ID
    ethers.parseUnits('100', 6), // 100 USDC
    proofData.proofBytes,
    publicValues
  );
  
  console.log('📤 Transaction sent:', tx.hash);
  const receipt = await tx.wait();
  console.log('✅ Deposit confirmed!');
  
  data.depositTx = tx.hash;
  
  // Check events
  const event = receipt.logs.find(log => {
    try {
      const parsed = contract.interface.parseLog(log);
      return parsed.name === 'PrivateDeposit';
    } catch {
      return false;
    }
  });
  
  if (event) {
    console.log('📢 Event emitted: PrivateDeposit');
  }
}

// Step 3: Private trade
async function privateTrade(contract, wallet, data) {
  console.log('Executing private spot trade...\n');
  
  // Generate trade proof
  console.log('🔄 Generating trade proof...');
  const proofData = await generateProof('trade', {
    secret: data.secret,
    nullifier: data.nullifier,
    fromAsset: 0, // USDC
    toAsset: 1, // ETH
    fromAmount: 50,
    minToAmount: 25,
    fromBalance: 100
  });
  
  console.log('✅ Trade proof generated!');
  
  // Encode public values
  const publicValues = ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes32', 'uint64', 'uint64', 'uint256', 'uint256'],
    [
      data.commitment,
      0, // From USDC
      1, // To ETH
      50, // Trade 50 USDC
      25  // Expect min 0.025 ETH
    ]
  );
  
  // Execute trade
  console.log('\n💱 Trading 50 USDC for ETH privately...');
  const tx = await contract.privateSpotTrade(
    proofData.proofBytes,
    publicValues
  );
  
  console.log('📤 Transaction sent:', tx.hash);
  await tx.wait();
  console.log('✅ Trade executed!');
  
  data.tradeTx = tx.hash;
}

// Step 4: Private withdrawal
async function privateWithdraw(contract, wallet, data) {
  console.log('Withdrawing remaining balance privately...\n');
  
  // Get merkle root
  const merkleRoot = await contract.getMerkleRoot();
  console.log('🌳 Merkle root:', merkleRoot);
  
  // Generate balance proof
  console.log('\n🔄 Generating balance proof...');
  const proofData = await generateProof('balance', {
    secret: data.secret,
    nullifier: data.nullifier,
    balance: 50, // Remaining USDC
    minBalance: 50,
    assetId: 0
  });
  
  console.log('✅ Balance proof generated!');
  
  // Encode public values
  const publicValues = ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes32', 'bytes32', 'uint256', 'uint64'],
    [
      data.commitment,
      merkleRoot,
      50, // Min balance to prove
      0   // USDC token ID
    ]
  );
  
  const nullifierHash = ethers.keccak256(data.nullifier);
  
  // Execute withdrawal
  console.log('\n💵 Withdrawing 50 USDC...');
  const tx = await contract.withdraw(
    nullifierHash,
    wallet.address,
    0, // USDC
    ethers.parseUnits('50', 6),
    proofData.proofBytes,
    publicValues
  );
  
  console.log('📤 Transaction sent:', tx.hash);
  await tx.wait();
  console.log('✅ Withdrawal complete!');
  
  data.withdrawTx = tx.hash;
}

// Helper: Generate proof (mock for demo)
async function generateProof(type, params) {
  // In production, this would call the actual proof generation service
  // For demo, we'll use mock data
  console.log(`  Type: ${type}`);
  console.log(`  Params:`, params);
  
  // Simulate proof generation time
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    proofBytes: '0x' + 'ab'.repeat(128), // Mock proof
    publicValues: params
  };
}

// Helper: Prompt user
function prompt(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

// Run demo
main().catch(console.error);