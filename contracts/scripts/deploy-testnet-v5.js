const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying HyperliquidPrivacySystemV5 to Hyperliquid Testnet...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Get account balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Use the existing MockSP1Verifier deployment
  const sp1VerifierAddress = "0x3B6041173B80E77f038f3F2C0f9744f04837185e";
  console.log("Using existing SP1 Verifier at:", sp1VerifierAddress);

  // Deploy HyperliquidPrivacySystemV5
  console.log("\nDeploying HyperliquidPrivacySystemV5...");
  const HyperliquidPrivacySystemV5 = await hre.ethers.getContractFactory("HyperliquidPrivacySystemV5");
  const privacySystem = await HyperliquidPrivacySystemV5.deploy(
    sp1VerifierAddress,
    deployer.address // Set deployer as initial compliance authority
  );

  await privacySystem.waitForDeployment();
  const privacySystemAddress = await privacySystem.getAddress();
  console.log("HyperliquidPrivacySystemV5 deployed to:", privacySystemAddress);

  // Save deployment info
  const deploymentInfo = {
    network: "hyperevm_testnet",
    contract: "HyperliquidPrivacySystemV5",
    address: privacySystemAddress,
    sp1Verifier: sp1VerifierAddress,
    complianceAuthority: deployer.address,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    verificationKeys: {
      ownership: "0x006bf06179a19e1575731cbb10c5b9cc955cae6f0a5de98cf8baf3c7c416131a",
      balance: "0x009c22b4f95fb710070dc80cfce7526c4cc7780834ab328bd769ff58934e6d05",
      compliance: "0x00ed1611619b8f2866de7be17d81a9d42a869b4c5959629708f125ae34a2f9ee",
      trade: "0x008484840d42565b9589f5c37253789d3731407964b1537fb5cf9d6064226b1c"
    },
    features: {
      twoStepDeposit: true,
      description: "V5 implements two-step deposit process for Hyperliquid compatibility"
    }
  };

  const deploymentPath = path.join(__dirname, "../deployments/hyperevm_testnet-v5-deployment.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\nDeployment info saved to:", deploymentPath);

  console.log("\n✅ Deployment complete!");
  console.log("\nNext steps:");
  console.log("1. Update frontend .env with new contract address:", privacySystemAddress);
  console.log("2. Implement two-step deposit flow in UI");
  console.log("3. Test deposit process:");
  console.log("   - Call prepareDeposit(token, amount)");
  console.log("   - Call transferToContract(token, amount) or use Hyperliquid UI");
  console.log("   - Call completeDeposit(commitment, proof, publicValues)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });