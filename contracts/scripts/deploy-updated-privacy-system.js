const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying updated privacy system with account:", deployer.address);

  // Get existing verifier address
  const verifierAddress = "0x1B830465Ad994B31457578f86B0927F10BB73Bc6"; // MockSP1Verifier
  const complianceAuthority = deployer.address;

  // Deploy updated privacy system
  console.log("\nDeploying updated HyperliquidPrivacySystemEVM...");
  const PrivacySystem = await ethers.getContractFactory("HyperliquidPrivacySystemEVM");
  const privacySystem = await PrivacySystem.deploy(verifierAddress, complianceAuthority);
  await privacySystem.waitForDeployment();
  
  const privacySystemAddress = await privacySystem.getAddress();
  console.log("✅ Privacy System deployed to:", privacySystemAddress);

  // Configure tokens
  const tokens = {
    WHYPE: "0x2ab8A4b3c496d8Ce56Fb6A28fd1Bec5b63fCF4d4",
    WETH: "0xB68B5A27fe8117837291617979b21ECbfbEAd2e3",
    USDC: "0x53AD7C0aF66E852c181E8Af93086b2c88B30cb74"
  };

  // Add tokens to privacy system
  console.log("\nAdding token support...");
  await privacySystem.addToken(0, tokens.WHYPE); // HYPE/WHYPE
  await privacySystem.addToken(2, tokens.WETH);  // WETH
  await privacySystem.addToken(3, tokens.USDC);  // USDC
  console.log("✅ Tokens configured");

  // Set DEX extension
  const dexExtensionAddress = "0xa9B4361F87d661f2025DD121423727Df08fef883";
  console.log("\nSetting DEX extension...");
  await privacySystem.setDexExtension(dexExtensionAddress);
  console.log("✅ DEX extension set");

  // Approve DEX for all tokens
  console.log("\nApproving DEX for tokens...");
  await privacySystem.approveDexForTokens([tokens.WHYPE, tokens.WETH, tokens.USDC]);
  console.log("✅ DEX approved for all tokens");

  console.log("\n📝 Deployment Summary:");
  console.log("Privacy System:", privacySystemAddress);
  console.log("DEX Extension:", dexExtensionAddress);
  console.log("Verifier:", verifierAddress);
  
  console.log("\n⚠️  IMPORTANT: Update your .env files with the new privacy system address!");
  console.log("REACT_APP_PRIVACY_SYSTEM_ADDRESS=" + privacySystemAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });