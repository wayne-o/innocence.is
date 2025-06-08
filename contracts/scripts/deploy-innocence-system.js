const hre = require("hardhat");

async function main() {
  console.log("Deploying Innocence-based Privacy System...");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Get network name
  const networkName = hre.network.name;
  console.log("Network:", networkName);
  
  // SP1 Verifier address (real Groth16 verifier on testnet)
  const sp1VerifierAddress = "0x90067a057D526AE2AcD13DfEc655Aa94aAe72693";
  console.log("Using SP1 Verifier at:", sp1VerifierAddress);
  
  // Deploy privacy system with innocence proof
  const PrivacySystem = await hre.ethers.getContractFactory("HyperliquidPrivacySystemInnocence");
  const privacySystem = await PrivacySystem.deploy(
    sp1VerifierAddress,
    deployer.address // Sanctions oracle (deployer for now)
  );
  
  await privacySystem.waitForDeployment();
  const privacySystemAddress = await privacySystem.getAddress();
  
  console.log("\nInnocence Privacy System deployed!");
  console.log("Address:", privacySystemAddress);
  console.log("Sanctions Oracle:", deployer.address);
  
  // Set initial sanctions root (empty for now)
  const emptySanctionsRoot = hre.ethers.ZeroHash;
  await privacySystem.updateSanctionsRoot(emptySanctionsRoot);
  console.log("Sanctions root initialized");
  
  // Save deployment info
  const deployment = {
    network: networkName,
    timestamp: new Date().toISOString(),
    contracts: {
      privacySystem: privacySystemAddress,
      sp1Verifier: sp1VerifierAddress,
      sanctionsOracle: deployer.address
    },
    sanctionsRoot: emptySanctionsRoot
  };
  
  const fs = require('fs');
  const deploymentPath = `deployments/${networkName}-innocence-deployment.json`;
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment saved to ${deploymentPath}`);
  
  // Deployment summary
  console.log("\n=== Deployment Summary ===");
  console.log("Privacy System:", privacySystemAddress);
  console.log("SP1 Verifier:", sp1VerifierAddress);
  console.log("Sanctions Oracle:", deployer.address);
  console.log("\nNext steps:");
  console.log("1. Update frontend with new contract address");
  console.log("2. Start proof service with sanctions oracle");
  console.log("3. Users must prove innocence before depositing");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });