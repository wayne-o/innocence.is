const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Updating DEX extension with new addresses...");

  // Current DEX extension
  const dexExtensionAddress = "0xa3F09EB1406209054FaC9EA6f4CA57F1B4b86260";
  
  // New addresses from the deployment
  const newAddresses = {
    swapRouter: "0x6091888770e27ff11f9bE07dD1ce15F1c0897F99",
    tokens: {
      WHYPE: "0x1eBF615D720041AB0E64112d6dbc2ea9A71abEEa", // TestWHYPE
      WETH: "0x64C60400f1eB8F5a5287347075d20061eaf23deb",   // WETH9
      USDC: "0xfC2348222447c85779Eebb46782335cdB5B56303",  // TestUSDC
      UBTC: "0x0000000000000000000000000000000000000000"   // Placeholder
    }
  };

  const dexExtensionABI = [
    "function configureTokens(address _whype, address _ubtc, address _ueth, address _usde) external",
    "function setSwapRouter(address _swapRouter) external",
    "function owner() view returns (address)",
    "function swapRouter() view returns (address)",
    "function tokenAddresses(uint64) view returns (address)"
  ];

  const dexExtension = new ethers.Contract(dexExtensionAddress, dexExtensionABI, deployer);

  // Check current configuration
  console.log("\nCurrent configuration:");
  console.log("Owner:", await dexExtension.owner());
  console.log("Current swap router:", await dexExtension.swapRouter());

  // Update swap router
  console.log("\nUpdating swap router to:", newAddresses.swapRouter);
  const tx1 = await dexExtension.setSwapRouter(newAddresses.swapRouter);
  await tx1.wait();
  console.log("✅ Swap router updated");

  // Update token addresses
  console.log("\nUpdating token addresses...");
  const tx2 = await dexExtension.configureTokens(
    newAddresses.tokens.WHYPE,
    newAddresses.tokens.UBTC,
    newAddresses.tokens.WETH,
    newAddresses.tokens.USDC
  );
  await tx2.wait();
  console.log("✅ Token addresses updated");

  // Verify configuration
  console.log("\nNew configuration:");
  console.log("Token 0 (WHYPE):", await dexExtension.tokenAddresses(0));
  console.log("Token 2 (WETH):", await dexExtension.tokenAddresses(2));
  console.log("Token 3 (USDC):", await dexExtension.tokenAddresses(3));
  console.log("Swap Router:", await dexExtension.swapRouter());

  // Update privacy system with new token approvals
  const privacySystemAddress = "0xC15D0a6Ca112a36283a309D801329Ade59CaBBA5";
  const privacySystemABI = [
    "function approveDexForTokens(address[] calldata tokens) external"
  ];
  
  const privacySystem = new ethers.Contract(privacySystemAddress, privacySystemABI, deployer);
  
  console.log("\nUpdating privacy system token approvals for new tokens...");
  await privacySystem.approveDexForTokens([
    newAddresses.tokens.WHYPE,
    newAddresses.tokens.WETH,
    newAddresses.tokens.USDC
  ]);
  console.log("✅ Privacy system approvals updated");

  console.log("\n✅ All configurations updated successfully!");
  console.log("\nIMPORTANT: Make sure the new Uniswap pools have liquidity:");
  console.log("- WHYPE/USDC pool");
  console.log("- WHYPE/WETH pool");
  console.log("- WETH/USDC pool");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });