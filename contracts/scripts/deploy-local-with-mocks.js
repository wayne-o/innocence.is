const hre = require("hardhat");

async function main() {
  console.log("Deploying to local Hardhat network with mocks...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // First, deploy mock HyperCore contracts
  console.log("\nDeploying Mock HyperCore contracts...");
  
  const MockHyperCoreRead = await hre.ethers.getContractFactory("MockHyperCoreRead");
  const mockRead = await MockHyperCoreRead.deploy();
  await mockRead.waitForDeployment();
  console.log("MockHyperCoreRead deployed to:", await mockRead.getAddress());

  const MockHyperCoreWrite = await hre.ethers.getContractFactory("MockHyperCoreWrite");
  const mockWrite = await MockHyperCoreWrite.deploy();
  await mockWrite.waitForDeployment();
  console.log("MockHyperCoreWrite deployed to:", await mockWrite.getAddress());

  // Deploy a modified privacy system that uses our mock addresses
  console.log("\nDeploying HyperliquidPrivacySystem...");
  
  // For local testing, we'll need to modify the contract to accept mock addresses
  // For now, deploy the standard contract
  const HyperliquidPrivacySystem = await hre.ethers.getContractFactory("HyperliquidPrivacySystem");
  const privacySystem = await HyperliquidPrivacySystem.deploy(deployer.address);
  await privacySystem.waitForDeployment();
  
  const contractAddress = await privacySystem.getAddress();
  console.log("HyperliquidPrivacySystem deployed to:", contractAddress);

  // Validate a test certificate for the deployer
  console.log("\nValidating test certificate for deployer...");
  await privacySystem.validateCertificate(
    deployer.address,
    "0x00", // dummy certificate
    "0x00"  // dummy signature
  );
  console.log("Test certificate validated!");

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: "localhost",
    contractAddress: contractAddress,
    mockReadAddress: await mockRead.getAddress(),
    mockWriteAddress: await mockWrite.getAddress(),
    complianceAuthority: deployer.address,
    deploymentTime: new Date().toISOString(),
    deployer: deployer.address,
    testAssets: [
      { id: 1, symbol: "BTC", price: 50000 },
      { id: 2, symbol: "ETH", price: 3000 },
      { id: 3, symbol: "SOL", price: 100 }
    ]
  };

  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
  }

  fs.writeFileSync(
    "./deployments/localhost-deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\nDeployment complete!");
  console.log("=====================================");
  console.log("Update your frontend .env with:");
  console.log(`REACT_APP_CONTRACT_ADDRESS=${contractAddress}`);
  console.log("=====================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });