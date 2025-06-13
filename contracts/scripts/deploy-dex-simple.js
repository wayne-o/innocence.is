const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
  console.log("🚀 Deploying Simple Private DEX Extension...\n");

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Contract addresses from previous deployments
  const PRIVACY_SYSTEM = "0xbfbC55261c22778686C2B44f596A6dA232Ae0779";
  const SWAP_ROUTER = "0xA8FAA918701e15c95A6df24DCA0CFB5Bcb1b44B7";
  
  // Token addresses
  const TOKENS = {
    WHYPE: "0x2ab8A4b3c496d8Ce56Fb6A28fd1Bec5b63fCF4d4",
    UBTC: "0x0000000000000000000000000000000000000000", // Not deployed yet
    WETH: "0xB68B5A27fe8117837291617979b21ECbfbEAd2e3",
    USDC: "0x53AD7C0aF66E852c181E8Af93086b2c88B30cb74"
  };

  // Deploy PrivateDEXExtensionSimple
  console.log("📋 Deploying PrivateDEXExtensionSimple...");
  const DEXSimple = await ethers.getContractFactory("PrivateDEXExtensionSimple");
  const dexSimple = await DEXSimple.deploy(PRIVACY_SYSTEM);
  await dexSimple.waitForDeployment();
  
  const dexAddress = await dexSimple.getAddress();
  console.log(`✅ PrivateDEXExtensionSimple deployed to: ${dexAddress}`);

  // Configure tokens
  console.log("\n📋 Configuring tokens...");
  const tx1 = await dexSimple.configureTokens(
    TOKENS.WHYPE,
    TOKENS.UBTC,
    TOKENS.WETH,
    TOKENS.USDC
  );
  await tx1.wait();
  console.log("✅ Tokens configured");

  // Set swap router
  console.log("\n📋 Setting swap router...");
  const tx2 = await dexSimple.setSwapRouter(SWAP_ROUTER);
  await tx2.wait();
  console.log("✅ Swap router set");

  // Save deployment info
  const fs = require('fs');
  const deploymentInfo = {
    network: "hyperliquid-testnet",
    timestamp: new Date().toISOString(),
    contracts: {
      PrivateDEXExtensionSimple: dexAddress,
      PrivacySystem: PRIVACY_SYSTEM,
      SwapRouter: SWAP_ROUTER
    },
    tokens: TOKENS
  };

  fs.writeFileSync(
    'deployments/dex-simple-deployment.json',
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n✅ Deployment complete!");
  console.log("\n📄 Deployment Summary:");
  console.log(`- PrivateDEXExtensionSimple: ${dexAddress}`);
  console.log(`- Privacy System: ${PRIVACY_SYSTEM}`);
  console.log(`- Swap Router: ${SWAP_ROUTER}`);
  
  console.log("\n🔧 Update your .env file:");
  console.log(`REACT_APP_DEX_EXTENSION=${dexAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });