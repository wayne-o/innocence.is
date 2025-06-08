const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// PRODUCTION DEPLOYMENT - Uses real SP1VerifierGroth16
// Prerequisites:
// 1. Set USE_GROTH16=true in proof-service/.env
// 2. Have Groth16 circuits downloaded
// 3. OR use Succinct Network with credentials

async function main() {
  console.log("\n=== DEPLOYING PRIVACY SYSTEM FOR PRODUCTION ===");
  console.log("✅ This deployment uses REAL SP1 Groth16 verification");
  console.log("✅ Ensure your proof service is configured for Groth16\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // Deploy Real SP1 Verifier (Groth16)
  console.log("\nDeploying SP1VerifierGroth16...");
  // In production, you might use the official deployed verifier address
  // For now, we'll deploy our own
  const SP1_VERIFIER_ADDRESS = "0x90067a057D526AE2AcD13DfEc655Aa94aAe72693"; // Your existing deployment
  
  console.log("Using existing SP1VerifierGroth16 at:", SP1_VERIFIER_ADDRESS);

  // Deploy Privacy System
  console.log("\nDeploying Privacy System EVM...");
  const PrivacySystem = await ethers.getContractFactory("HyperliquidPrivacySystemEVM");
  const privacySystem = await PrivacySystem.deploy(
    SP1_VERIFIER_ADDRESS,
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
      sp1Verifier: SP1_VERIFIER_ADDRESS,
      complianceAuthority: deployer.address
    },
    verifierType: "SP1VerifierGroth16 (Real)",
    version: "v5.0.0-production"
  };

  const deploymentPath = path.join(__dirname, `../deployments/${network.name}-production-deployment.json`);
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

  console.log("\n✅ Production deployment complete!");
  console.log("\nNEXT STEPS:");
  console.log("1. Ensure proof service .env has USE_GROTH16=true");
  console.log("2. Restart proof service");
  console.log("3. Proofs will take 5-10 minutes to generate");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });