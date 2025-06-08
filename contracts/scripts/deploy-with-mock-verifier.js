const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n=== DEPLOYING PRIVACY SYSTEM WITH MOCK VERIFIER ===");
  console.log("⚠️  WARNING: This uses a MOCK verifier for testing only!");
  console.log("⚠️  To switch to production: Update .env and redeploy with real verifier\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // Deploy Mock SP1 Verifier
  console.log("\nDeploying Mock SP1 Verifier...");
  const MockVerifier = await ethers.getContractFactory("MockSP1Verifier");
  const mockVerifier = await MockVerifier.deploy();
  await mockVerifier.waitForDeployment();
  const mockVerifierAddress = await mockVerifier.getAddress();
  console.log("Mock SP1 Verifier deployed to:", mockVerifierAddress);

  // Deploy Privacy System
  console.log("\nDeploying Privacy System EVM...");
  const PrivacySystem = await ethers.getContractFactory("HyperliquidPrivacySystemEVM");
  const privacySystem = await PrivacySystem.deploy(
    mockVerifierAddress,
    deployer.address // compliance authority
  );
  await privacySystem.waitForDeployment();
  const privacySystemAddress = await privacySystem.getAddress();
  console.log("Privacy System deployed to:", privacySystemAddress);

  // Save deployment info
  const deployment = {
    network: network.name,
    timestamp: new Date().toISOString(),
    contracts: {
      privacySystem: privacySystemAddress,
      sp1Verifier: mockVerifierAddress,
      complianceAuthority: deployer.address
    },
    verifierType: "MockSP1Verifier",
    version: "v5.0.0-mock"
  };

  const deploymentPath = path.join(__dirname, `../deployments/${network.name}-mock-verifier-deployment.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("\nDeployment info saved to:", deploymentPath);

  // Update frontend config
  const configPath = path.join(__dirname, "../../frontend/innocence-ui/src/config/networks.ts");
  if (fs.existsSync(configPath)) {
    let config = fs.readFileSync(configPath, 'utf8');
    
    // Update contract addresses
    config = config.replace(
      /PRIVACY_SYSTEM_ADDRESS:\s*['"]0x[a-fA-F0-9]+['"]/,
      `PRIVACY_SYSTEM_ADDRESS: '${privacySystemAddress}'`
    );
    
    fs.writeFileSync(configPath, config);
    console.log("\nFrontend config updated!");
  }

  console.log("\n✅ Deployment complete!");
  console.log("\nNOTE: This deployment uses a mock verifier that accepts ANY proof.");
  console.log("This is suitable for testing but NOT for production.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });