const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying HyperliquidTransferHelper...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Deploy HyperliquidTransferHelper
  const TransferHelper = await hre.ethers.getContractFactory("HyperliquidTransferHelper");
  const transferHelper = await TransferHelper.deploy();
  await transferHelper.waitForDeployment();
  
  const helperAddress = await transferHelper.getAddress();
  console.log("HyperliquidTransferHelper deployed to:", helperAddress);

  // Save deployment info
  const deploymentInfo = {
    network: "hyperevm_testnet",
    contract: "HyperliquidTransferHelper",
    address: helperAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    description: "Helper contract for user-initiated token transfers on Hyperliquid"
  };

  const deploymentPath = path.join(__dirname, "../deployments/transfer-helper-deployment.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\nDeployment info saved to:", deploymentPath);

  console.log("\n✅ Deployment complete!");
  console.log("\nThis helper allows users to transfer tokens directly.");
  console.log("Users call transferTokens() and the tokens come from their wallet.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });