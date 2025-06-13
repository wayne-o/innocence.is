const hre = require("hardhat");

async function main() {
  console.log("Deploying Privacy System with DEX Integration...");
  
  // Get existing contracts
  const SP1_VERIFIER = "0x1B830465Ad994B31457578f86B0927F10BB73Bc6"; // MockSP1Verifier
  const COMPLIANCE_AUTHORITY = "0x5Bd2F329C50860366c0E6D3b4227a422B66AD203";
  
  // Deploy new privacy system with DEX
  const PrivacySystemWithDEX = await hre.ethers.getContractFactory("HyperliquidPrivacySystemWithDEX");
  const privacySystem = await PrivacySystemWithDEX.deploy(
    SP1_VERIFIER,
    COMPLIANCE_AUTHORITY
  );
  
  await privacySystem.waitForDeployment();
  const address = await privacySystem.getAddress();
  
  console.log("\n✅ Privacy System with DEX deployed to:", address);
  console.log("\nIntegrated with:");
  console.log("- Moonswap Router:", "0xEBd14cdF290185Cc4d0b5eC73A0e095d780e5D2f");
  console.log("- SP1 Verifier:", SP1_VERIFIER);
  console.log("- Compliance Authority:", COMPLIANCE_AUTHORITY);
  
  console.log("\nSupported tokens:");
  console.log("- HYPE (native): Token ID 0");
  console.log("- UBTC: Token ID 1");
  console.log("- UETH: Token ID 2");
  console.log("- USDE: Token ID 3");
  
  // Verify token mappings
  const ubtcAddress = await privacySystem.tokenAddresses(1);
  console.log("\nVerifying token mappings:");
  console.log("- UBTC mapping:", ubtcAddress);
  
  console.log("\n🎉 Deployment complete!");
  console.log("\nNext steps:");
  console.log("1. Update frontend to use new contract:", address);
  console.log("2. Test private swap functionality");
  console.log("3. Deploy swap proof generation circuit");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });