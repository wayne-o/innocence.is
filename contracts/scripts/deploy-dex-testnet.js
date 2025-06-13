const hre = require("hardhat");

async function main() {
  console.log("Deploying Private DEX Extension for Testnet...");
  
  // Use existing privacy system on testnet
  const PRIVACY_SYSTEM = "0xbfbC55261c22778686C2B44f596A6dA232Ae0779";
  
  // Deploy DEX extension
  const PrivateDEXExtension = await hre.ethers.getContractFactory("PrivateDEXExtensionTestnet");
  const dexExtension = await PrivateDEXExtension.deploy(PRIVACY_SYSTEM);
  
  await dexExtension.waitForDeployment();
  const address = await dexExtension.getAddress();
  
  console.log("\n✅ Private DEX Extension (Testnet) deployed to:", address);
  console.log("\nConfiguration:");
  console.log("- Privacy System:", PRIVACY_SYSTEM);
  console.log("- Owner:", await dexExtension.owner());
  
  console.log("\n⚠️  IMPORTANT: Token addresses and router need to be configured!");
  console.log("\nNext steps:");
  console.log("1. Deploy or find testnet versions of:");
  console.log("   - Moonswap Router");
  console.log("   - WHYPE (Wrapped HYPE)");
  console.log("   - Test tokens (UBTC, UETH, USDE)");
  console.log("\n2. Configure tokens:");
  console.log(`   await dexExtension.configureTokens(WHYPE, UBTC, UETH, USDE)`);
  console.log("\n3. Set swap router:");
  console.log(`   await dexExtension.setSwapRouter(ROUTER_ADDRESS)`);
  
  // If you have testnet addresses, uncomment and update:
  /*
  console.log("\nConfiguring with testnet addresses...");
  
  const TESTNET_ADDRESSES = {
    WHYPE: "0x...", // Testnet WHYPE
    UBTC: "0x...",  // Testnet UBTC
    UETH: "0x...",  // Testnet UETH
    USDE: "0x...",  // Testnet USDE
    ROUTER: "0x..." // Testnet Moonswap Router
  };
  
  // Configure tokens
  await dexExtension.configureTokens(
    TESTNET_ADDRESSES.WHYPE,
    TESTNET_ADDRESSES.UBTC,
    TESTNET_ADDRESSES.UETH,
    TESTNET_ADDRESSES.USDE
  );
  
  // Set router
  await dexExtension.setSwapRouter(TESTNET_ADDRESSES.ROUTER);
  
  console.log("\n✅ Testnet configuration complete!");
  */
  
  console.log("\n🎉 Deployment complete!");
  console.log("\nContract address:", address);
  console.log("\nSave this address for frontend configuration");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });