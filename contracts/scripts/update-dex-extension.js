const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Updating DEX extension with account:", deployer.address);

  const newPrivacySystemAddress = "0xC15D0a6Ca112a36283a309D801329Ade59CaBBA5";
  
  // Deploy new DEX extension with updated privacy system
  console.log("\nDeploying new PrivateDEXExtensionSimple...");
  const DEXExtension = await ethers.getContractFactory("PrivateDEXExtensionSimple");
  const dexExtension = await DEXExtension.deploy(newPrivacySystemAddress);
  await dexExtension.waitForDeployment();
  
  const dexExtensionAddress = await dexExtension.getAddress();
  console.log("✅ DEX Extension deployed to:", dexExtensionAddress);

  // Configure tokens
  const tokens = {
    WHYPE: "0x2ab8A4b3c496d8Ce56Fb6A28fd1Bec5b63fCF4d4",
    WETH: "0xB68B5A27fe8117837291617979b21ECbfbEAd2e3",
    USDC: "0x53AD7C0aF66E852c181E8Af93086b2c88B30cb74",
    UBTC: "0x0000000000000000000000000000000000000000" // Placeholder
  };

  // Configure tokens in DEX
  console.log("\nConfiguring tokens...");
  await dexExtension.configureTokens(
    tokens.WHYPE,
    tokens.UBTC,
    tokens.WETH,
    tokens.USDC
  );
  console.log("✅ Tokens configured");

  // Set swap router
  const swapRouterAddress = "0xA8FAA918701e15c95A6df24DCA0CFB5Bcb1b44B7";
  console.log("\nSetting swap router...");
  await dexExtension.setSwapRouter(swapRouterAddress);
  console.log("✅ Swap router set");

  // Update privacy system to use new DEX
  const privacySystemABI = [
    "function setDexExtension(address _dexExtension) external",
    "function approveDexForTokens(address[] calldata tokens) external"
  ];
  
  const privacySystem = new ethers.Contract(newPrivacySystemAddress, privacySystemABI, deployer);
  
  console.log("\nUpdating privacy system with new DEX extension...");
  await privacySystem.setDexExtension(dexExtensionAddress);
  console.log("✅ DEX extension updated in privacy system");
  
  // Re-approve tokens for new DEX
  console.log("\nApproving new DEX for tokens...");
  await privacySystem.approveDexForTokens([tokens.WHYPE, tokens.WETH, tokens.USDC]);
  console.log("✅ Tokens approved for new DEX");

  console.log("\n📝 Updated Configuration:");
  console.log("Privacy System:", newPrivacySystemAddress);
  console.log("New DEX Extension:", dexExtensionAddress);
  console.log("Swap Router:", swapRouterAddress);
  
  console.log("\n⚠️  IMPORTANT: Update your .env files:");
  console.log("REACT_APP_PRIVACY_SYSTEM_ADDRESS=" + newPrivacySystemAddress);
  console.log("REACT_APP_DEX_EXTENSION=" + dexExtensionAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });