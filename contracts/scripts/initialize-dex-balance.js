const { ethers } = require("ethers");
require('dotenv').config();

// Connect to Hyperliquid testnet
const provider = new ethers.JsonRpcProvider("https://rpc.hyperliquid-testnet.xyz/evm");

// Contract addresses
const DEX_EXTENSION = "0x34CE8187a2903905aE4b0EF6f47F8D70A63C75Af";
const PRIVACY_SYSTEM = "0xbfbC55261c22778686C2B44f596A6dA232Ae0779";

// Contract ABIs
const DEX_EXTENSION_ABI = [
  "function initializeBalance(bytes32 commitment) external",
  "function balances(bytes32 commitment, uint32 assetId) view returns (uint256)",
  "function getBalances(bytes32 commitment) view returns (uint256[] memory)"
];

const PRIVACY_SYSTEM_ABI = [
  "function deposits(bytes32) view returns (address depositor, uint256 amount, uint64 assetId, uint256 timestamp)"
];

async function initializeDexBalance(privateKey, commitment) {
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`\n🔍 Initializing DEX balance for commitment: ${commitment}`);
  console.log(`Wallet address: ${wallet.address}\n`);
  
  try {
    // Create contract instances
    const dexExtension = new ethers.Contract(DEX_EXTENSION, DEX_EXTENSION_ABI, wallet);
    const privacySystem = new ethers.Contract(PRIVACY_SYSTEM, PRIVACY_SYSTEM_ABI, wallet);
    
    // Check if deposit exists
    const deposit = await privacySystem.deposits(commitment);
    console.log("📋 Deposit info:");
    console.log(`- Depositor: ${deposit.depositor}`);
    console.log(`- Amount: ${ethers.formatUnits(deposit.amount, 18)}`);
    console.log(`- Asset ID: ${deposit.assetId}`);
    
    if (deposit.depositor === ethers.ZeroAddress) {
      console.log("❌ No deposit found for this commitment!");
      return;
    }
    
    // Check current balances
    console.log("\n💰 Current DEX balances:");
    try {
      const balances = await dexExtension.getBalances(commitment);
      balances.forEach((bal, idx) => {
        console.log(`- Asset ${idx}: ${ethers.formatUnits(bal, 18)}`);
      });
      
      // Check if already initialized
      const depositedAssetBalance = await dexExtension.balances(commitment, deposit.assetId);
      if (depositedAssetBalance > 0n) {
        console.log("\n✅ Balance already initialized!");
        return;
      }
    } catch (e) {
      console.log("- No balances found (not initialized)");
    }
    
    // Initialize balance
    console.log("\n🚀 Initializing balance...");
    const tx = await dexExtension.initializeBalance(commitment);
    console.log(`Transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`✅ Balance initialized! Gas used: ${receipt.gasUsed.toString()}`);
    
    // Check new balances
    console.log("\n💰 New DEX balances:");
    const newBalances = await dexExtension.getBalances(commitment);
    newBalances.forEach((bal, idx) => {
      console.log(`- Asset ${idx}: ${ethers.formatUnits(bal, 18)}`);
    });
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
  }
}

// Get arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  // Use default test values
  const testPrivateKey = process.env.PRIVATE_KEY || "0x1234567890123456789012345678901234567890123456789012345678901234";
  const testCommitment = "0x05ae9af701d29f08374423c58a07ba14023268c7018e91219fd05947867f30a1";
  
  console.log("Usage: node initialize-dex-balance.js <privateKey> <commitment>");
  console.log("\nRunning with test values...");
  
  initializeDexBalance(testPrivateKey, testCommitment).catch(console.error);
} else if (args.length === 2) {
  const [privateKey, commitment] = args;
  initializeDexBalance(privateKey, commitment).catch(console.error);
} else {
  console.log("Usage: node initialize-dex-balance.js <privateKey> <commitment>");
}