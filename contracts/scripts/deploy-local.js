const hre = require("hardhat");

async function main() {
  console.log("Deploying to local Hardhat network...");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  
  // Get account balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

  // Deploy the HyperliquidPrivacySystem contract
  const HyperliquidPrivacySystem = await hre.ethers.getContractFactory("HyperliquidPrivacySystem");
  const privacySystem = await HyperliquidPrivacySystem.deploy(deployer.address);

  await privacySystem.waitForDeployment();
  const contractAddress = await privacySystem.getAddress();

  console.log("HyperliquidPrivacySystem deployed to:", contractAddress);
  console.log("Compliance authority set to:", deployer.address);

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: "localhost",
    contractAddress: contractAddress,
    complianceAuthority: deployer.address,
    deploymentTime: new Date().toISOString(),
    deployer: deployer.address,
  };

  // Create deployments directory if it doesn't exist
  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
  }

  fs.writeFileSync(
    "./deployments/localhost-deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\nDeployment info saved to deployments/localhost-deployment.json");
  console.log("\nIMPORTANT: Update your frontend .env with:");
  console.log(`REACT_APP_CONTRACT_ADDRESS=${contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });