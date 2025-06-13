const { ethers } = require("ethers");
require('dotenv').config();

// Connect to Hyperliquid testnet
const provider = new ethers.JsonRpcProvider("https://rpc.hyperliquid-testnet.xyz/evm");

// Contract addresses
const DEX_EXTENSION = "0x34CE8187a2903905aE4b0EF6f47F8D70A63C75Af";
const PRIVACY_SYSTEM = "0xbfbC55261c22778686C2B44f596A6dA232Ae0779";

async function checkContracts() {
  console.log("🔍 Checking contract deployment...\n");
  
  try {
    // Check if contracts have code
    const dexCode = await provider.getCode(DEX_EXTENSION);
    const privacyCode = await provider.getCode(PRIVACY_SYSTEM);
    
    console.log(`DEX Extension (${DEX_EXTENSION}):`);
    console.log(`- Has code: ${dexCode !== '0x'} (${dexCode.length} bytes)`);
    
    console.log(`\nPrivacy System (${PRIVACY_SYSTEM}):`);
    console.log(`- Has code: ${privacyCode !== '0x'} (${privacyCode.length} bytes)`);
    
    // Try to call basic view functions
    if (dexCode !== '0x') {
      // Load the testnet ABI
      const fs = require('fs');
      const path = require('path');
      
      const testnetAbiPath = path.join(__dirname, '../artifacts/contracts/PrivateDEXExtensionTestnet.sol/PrivateDEXExtensionTestnet.json');
      const normalAbiPath = path.join(__dirname, '../artifacts/contracts/PrivateDEXExtension.sol/PrivateDEXExtension.json');
      
      let abi;
      let contractName;
      
      if (fs.existsSync(testnetAbiPath)) {
        const artifact = JSON.parse(fs.readFileSync(testnetAbiPath, 'utf8'));
        abi = artifact.abi;
        contractName = "PrivateDEXExtensionTestnet";
      } else if (fs.existsSync(normalAbiPath)) {
        const artifact = JSON.parse(fs.readFileSync(normalAbiPath, 'utf8'));
        abi = artifact.abi;
        contractName = "PrivateDEXExtension";
      } else {
        console.log("❌ Could not find contract ABI");
        return;
      }
      
      console.log(`\n📋 Using ABI from: ${contractName}`);
      
      const dexExtension = new ethers.Contract(DEX_EXTENSION, abi, provider);
      
      // Try to call view functions
      console.log("\n🔍 Checking contract functions:");
      
      try {
        const privacySystemAddr = await dexExtension.privacySystem();
        console.log(`✓ privacySystem(): ${privacySystemAddr}`);
      } catch (e) {
        console.log(`✗ privacySystem(): ${e.message}`);
      }
      
      try {
        const swapRouter = await dexExtension.swapRouter();
        console.log(`✓ swapRouter(): ${swapRouter}`);
      } catch (e) {
        console.log(`✗ swapRouter(): ${e.message}`);
      }
      
      // Check for specific functions
      const functionSignatures = [
        'initializeBalance(bytes32)',
        'privateSwap(bytes32,bytes,bytes,uint24)',
        'balances(bytes32,uint32)',
        'getBalances(bytes32)'
      ];
      
      console.log("\n📝 Checking function selectors:");
      for (const sig of functionSignatures) {
        const selector = ethers.id(sig).slice(0, 10);
        console.log(`${sig}: ${selector}`);
      }
      
      // Try to decode the failing transaction
      console.log("\n🔍 Decoding failing transaction:");
      const failingData = "0x7ec221c405ae9af701d29f08374423c58a07ba14023268c7018e91219fd05947867f30a10000000000000000000000000000000000000000000000000000000000000000";
      const functionSelector = failingData.slice(0, 10);
      console.log(`Function selector: ${functionSelector}`);
      
      // Find matching function
      const iface = new ethers.Interface(abi);
      try {
        const decoded = iface.parseTransaction({ data: failingData });
        console.log(`Function name: ${decoded.name}`);
        console.log(`Arguments:`, decoded.args);
      } catch (e) {
        console.log(`Could not decode: ${e.message}`);
      }
      
    }
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
  }
}

checkContracts().catch(console.error);