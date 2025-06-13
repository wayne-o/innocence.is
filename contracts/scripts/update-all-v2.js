const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying new DEX extension for updated privacy system...");

  const newPrivacySystemAddress = "0x07Ee16F77aC3BbD59eAaAA1c262629C69B0752dA";
  
  // Deploy new DEX extension
  console.log("\nDeploying PrivateDEXExtensionSimple...");
  const DEXExtension = await ethers.getContractFactory("PrivateDEXExtensionSimple");
  const dexExtension = await DEXExtension.deploy(newPrivacySystemAddress);
  await dexExtension.waitForDeployment();
  
  const dexAddress = await dexExtension.getAddress();
  console.log("✅ DEX Extension deployed to:", dexAddress);

  // Configure tokens
  console.log("\nConfiguring tokens...");
  await dexExtension.configureTokens(
    "0x1eBF615D720041AB0E64112d6dbc2ea9A71abEEa", // TestWHYPE
    "0x0000000000000000000000000000000000000000", // UBTC (placeholder)
    "0x64C60400f1eB8F5a5287347075d20061eaf23deb", // WETH9
    "0xfC2348222447c85779Eebb46782335cdB5B56303"  // TestUSDC
  );
  console.log("✅ Tokens configured");

  // Set swap router
  console.log("\nSetting swap router...");
  await dexExtension.setSwapRouter("0x6091888770e27ff11f9bE07dD1ce15F1c0897F99");
  console.log("✅ Swap router set");

  // Update privacy system
  const privacyABI = [
    "function setDexExtension(address) external",
    "function approveDexForTokens(address[]) external"
  ];
  
  const privacySystem = new ethers.Contract(newPrivacySystemAddress, privacyABI, deployer);
  
  console.log("\nUpdating privacy system...");
  await privacySystem.setDexExtension(dexAddress);
  await privacySystem.approveDexForTokens([
    "0x1eBF615D720041AB0E64112d6dbc2ea9A71abEEa", // TestWHYPE
    "0x64C60400f1eB8F5a5287347075d20061eaf23deb", // WETH9
    "0xfC2348222447c85779Eebb46782335cdB5B56303"  // TestUSDC
  ]);
  console.log("✅ Privacy system updated");

  console.log("\n📝 Final Configuration:");
  console.log("Privacy System:", newPrivacySystemAddress);
  console.log("DEX Extension:", dexAddress);
  
  console.log("\n⚠️  Update your .env:");
  console.log("REACT_APP_PRIVACY_SYSTEM_ADDRESS=" + newPrivacySystemAddress);
  console.log("REACT_APP_DEX_EXTENSION=" + dexAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });