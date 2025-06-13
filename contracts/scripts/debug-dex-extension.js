const { ethers } = require("ethers");
require('dotenv').config();

// Connect to Hyperliquid testnet
const provider = new ethers.JsonRpcProvider("https://rpc.hyperliquid-testnet.xyz/evm");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || "0x1234567890123456789012345678901234567890123456789012345678901234", provider);

// Contract addresses
const DEX_EXTENSION = "0x34CE8187a2903905aE4b0EF6f47F8D70A63C75Af";
const PRIVACY_SYSTEM = "0xbfbC55261c22778686C2B44f596A6dA232Ae0779";

// Test data from the error
const TEST_NULLIFIER = "0xa1ab25f3e07ab2074c3f687de14369626bdff848f01011296965a643f6f705e5";
const TEST_COMMITMENT = "0x05ae9af701d29f08374423c58a07ba14023268c7018e91219fd05947867f30a1";

// Contract ABIs
const DEX_EXTENSION_ABI = [
  "function privacySystem() view returns (address)",
  "function swapRouter() view returns (address)",
  "function balances(bytes32 commitment, uint32 assetId) view returns (uint256)",
  "function getBalances(bytes32 commitment) view returns (uint256[] memory)",
  "function privateSwap(bytes32 nullifier, bytes calldata proof, bytes calldata publicValues, uint24 fee) external returns (uint256 amountOut)",
  "function owner() view returns (address)",
  "function usedNullifiers(bytes32) view returns (bool)"
];

const PRIVACY_SYSTEM_ABI = [
  "function verifier() view returns (address)",
  "function deposits(bytes32) view returns (address depositor, uint256 amount, uint64 assetId, uint256 timestamp)",
  "function merkleRoot() view returns (bytes32)"
];

async function debugDexExtension() {
  console.log("🔍 Debugging DEX Extension Contract...\n");
  console.log(`Wallet address: ${wallet.address}`);
  
  try {
    // Create contract instances
    const dexExtension = new ethers.Contract(DEX_EXTENSION, DEX_EXTENSION_ABI, wallet);
    const privacySystem = new ethers.Contract(PRIVACY_SYSTEM, PRIVACY_SYSTEM_ABI, wallet);
    
    // Check basic contract state
    console.log("\n📋 DEX Extension State:");
    const privacySystemAddr = await dexExtension.privacySystem();
    console.log(`Privacy System: ${privacySystemAddr}`);
    
    const swapRouter = await dexExtension.swapRouter();
    console.log(`Swap Router: ${swapRouter}`);
    
    const owner = await dexExtension.owner();
    console.log(`Owner: ${owner}`);
    
    // Check if nullifier is already used
    const nullifierUsed = await dexExtension.usedNullifiers(TEST_NULLIFIER);
    console.log(`\nNullifier ${TEST_NULLIFIER.slice(0, 10)}... used: ${nullifierUsed}`);
    
    // Check commitment balances
    console.log(`\n💰 Checking balances for commitment ${TEST_COMMITMENT.slice(0, 10)}...`);
    try {
      const allBalances = await dexExtension.getBalances(TEST_COMMITMENT);
      console.log(`All balances:`, allBalances.map(b => b.toString()));
      
      // Check specific token balances
      for (let i = 0; i < 4; i++) {
        const balance = await dexExtension.balances(TEST_COMMITMENT, i);
        console.log(`Asset ${i} balance: ${balance.toString()}`);
      }
    } catch (e) {
      console.log("Error getting balances:", e.message);
    }
    
    // Check deposit in privacy system
    console.log(`\n🔐 Checking deposit in privacy system...`);
    const deposit = await privacySystem.deposits(TEST_COMMITMENT);
    console.log(`Depositor: ${deposit.depositor}`);
    console.log(`Amount: ${deposit.amount.toString()}`);
    console.log(`Asset ID: ${deposit.assetId}`);
    console.log(`Timestamp: ${deposit.timestamp.toString()}`);
    
    // Check verifier
    const verifier = await privacySystem.verifier();
    console.log(`\nVerifier: ${verifier}`);
    
    // Try to decode the calldata
    console.log("\n📦 Decoding transaction data...");
    const txData = "0xa8ebbae6a1ab25f3e07ab2074c3f687de14369626bdff848f01011296965a643f6f705e5000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000bb80000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a005ae9af701d29f08374423c58a07ba14023268c7018e91219fd05947867f30a100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000016345785d8a000000000000000000000000000000000000000000000000000001606f3d18af9800";
    
    const iface = new ethers.Interface(DEX_EXTENSION_ABI);
    const decoded = iface.parseTransaction({ data: txData });
    
    console.log("\nFunction:", decoded.name);
    console.log("Arguments:");
    console.log("- Nullifier:", decoded.args[0]);
    console.log("- Proof length:", decoded.args[1].length);
    console.log("- Public values:", decoded.args[2]);
    console.log("- Fee:", decoded.args[3]);
    
    // Decode public values
    const publicValues = decoded.args[2];
    const publicValuesDecoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ['bytes32', 'address', 'uint32', 'uint32', 'uint256', 'uint256', 'bytes32'],
      publicValues
    );
    
    console.log("\nDecoded public values:");
    console.log("- Commitment:", publicValuesDecoded[0]);
    console.log("- User:", publicValuesDecoded[1]);
    console.log("- From Asset:", publicValuesDecoded[2]);
    console.log("- To Asset:", publicValuesDecoded[3]);
    console.log("- From Amount:", ethers.formatUnits(publicValuesDecoded[4], 18));
    console.log("- Min To Amount:", ethers.formatUnits(publicValuesDecoded[5], 18));
    console.log("- Merkle Root:", publicValuesDecoded[6]);
    
    // Check if the commitment has been initialized
    console.log("\n🔍 Possible issues:");
    
    // 1. Check if commitment exists in privacy system
    if (deposit.depositor === ethers.ZeroAddress) {
      console.log("❌ Commitment not found in privacy system - needs deposit first");
    }
    
    // 2. Check if commitment has been initialized in DEX
    const balance0 = await dexExtension.balances(TEST_COMMITMENT, 0);
    if (balance0 == 0n && deposit.assetId == 0) {
      console.log("❌ Commitment balance not initialized in DEX - call initializeBalance first");
    }
    
    // 3. Check if trying to swap from asset with 0 balance
    const fromAsset = publicValuesDecoded[2];
    const fromBalance = await dexExtension.balances(TEST_COMMITMENT, fromAsset);
    if (fromBalance == 0n) {
      console.log(`❌ No balance for asset ${fromAsset} to swap from`);
    }
    
    // 4. Check if amount exceeds balance
    const fromAmount = publicValuesDecoded[4];
    if (fromBalance < fromAmount) {
      console.log(`❌ Insufficient balance: have ${fromBalance}, need ${fromAmount}`);
    }
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
  }
}

debugDexExtension().catch(console.error);