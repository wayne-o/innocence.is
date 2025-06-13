const { ethers } = require("ethers");
require('dotenv').config();

// Connect to Hyperliquid testnet
const provider = new ethers.JsonRpcProvider("https://rpc.hyperliquid-testnet.xyz/evm");

// Contract addresses
const PRIVACY_SYSTEM = "0xbfbC55261c22778686C2B44f596A6dA232Ae0779";
const TEST_COMMITMENT = "0x726525a79d58ad96c079b9c46797b5ad2c96e4ac5c5b48b0e78e14c039cd7a74";

// Load the ABI from artifacts
const fs = require('fs');
const path = require('path');

async function testDeposits() {
  console.log("🔍 Testing deposits function...\n");
  
  try {
    // Try loading the contract ABI
    const artifactPath = path.join(__dirname, '../artifacts/contracts/HyperliquidPrivacySystemEVM.sol/HyperliquidPrivacySystemEVM.json');
    
    if (!fs.existsSync(artifactPath)) {
      console.log("❌ Could not find contract artifact");
      return;
    }
    
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const abi = artifact.abi;
    
    console.log("📋 Contract functions related to deposits:");
    const depositFunctions = abi.filter(item => 
      item.name && item.name.toLowerCase().includes('deposit')
    );
    
    depositFunctions.forEach(func => {
      console.log(`- ${func.name}(${func.inputs?.map(i => i.type).join(', ')})`);
    });
    
    // Create contract instance
    const privacySystem = new ethers.Contract(PRIVACY_SYSTEM, abi, provider);
    
    // Check if deposits mapping exists
    const depositsFunc = abi.find(item => item.name === 'deposits');
    if (depositsFunc) {
      console.log("\n✅ Found deposits function");
      console.log("Inputs:", depositsFunc.inputs);
      console.log("Outputs:", depositsFunc.outputs);
    } else {
      console.log("\n❌ No public deposits mapping found");
      
      // Look for alternative functions
      console.log("\n🔍 Looking for alternative functions to get deposit info:");
      const getters = abi.filter(item => 
        item.type === 'function' && 
        item.stateMutability === 'view' &&
        (item.name.includes('deposit') || item.name.includes('Deposit'))
      );
      
      getters.forEach(func => {
        console.log(`- ${func.name}(${func.inputs?.map(i => `${i.type} ${i.name}`).join(', ')})`);
      });
    }
    
    // Try to call deposits if it exists
    if (depositsFunc) {
      try {
        console.log(`\n📊 Checking deposit for commitment: ${TEST_COMMITMENT}`);
        const deposit = await privacySystem.deposits(TEST_COMMITMENT);
        console.log("Deposit info:", deposit);
      } catch (e) {
        console.log("Error calling deposits:", e.message);
      }
    }
    
    // Check commitments mapping
    const commitmentsFunc = abi.find(item => item.name === 'commitments');
    if (commitmentsFunc) {
      try {
        console.log(`\n📊 Checking if commitment exists: ${TEST_COMMITMENT}`);
        const exists = await privacySystem.commitments(TEST_COMMITMENT);
        console.log("Commitment exists:", exists);
      } catch (e) {
        console.log("Error checking commitment:", e.message);
      }
    }
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
  }
}

testDeposits().catch(console.error);