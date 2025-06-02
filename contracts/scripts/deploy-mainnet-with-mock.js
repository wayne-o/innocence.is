const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

// Load mainnet configuration
const config = require('../../config/mainnet.json');

async function main() {
  console.log("🚀 Starting Innocence mainnet deployment with MOCK verifier...");
  console.log("⚠️  WARNING: This deployment uses a MOCK verifier for testing only!");
  console.log("⚠️  DO NOT use this for production funds until real SP1 verifier is deployed!");
  
  // Mainnet safety checks
  const chainId = await hre.ethers.provider.getNetwork().then(n => n.chainId);
  if (chainId !== 999n) { // Hyperliquid mainnet chain ID
    throw new Error(`Wrong network! Expected mainnet (999), got ${chainId}`);
  }
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("\nDeploying contracts with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "HYPE");
  
  if (balance < hre.ethers.parseEther("0.1")) {
    throw new Error("Insufficient HYPE balance for deployment. Need at least 0.1 HYPE");
  }
  
  // Deploy Mock SP1 Verifier
  console.log("\n1. Deploying MockSP1Verifier (TEMPORARY - REPLACE FOR PRODUCTION)...");
  const MockSP1Verifier = await hre.ethers.getContractFactory("MockSP1Verifier");
  const mockVerifier = await MockSP1Verifier.deploy();
  await mockVerifier.waitForDeployment();
  const mockVerifierAddress = await mockVerifier.getAddress();
  console.log("✅ MockSP1Verifier deployed to:", mockVerifierAddress);
  
  // Set to always valid for testing
  await mockVerifier.setAlwaysValid(true);
  console.log("✅ Mock verifier set to always valid (TESTING ONLY)");
  
  // Deploy InnocenceVerificationKeys
  console.log("\n2. Deploying InnocenceVerificationKeys...");
  const VerificationKeys = await hre.ethers.getContractFactory("InnocenceVerificationKeys");
  const verificationKeys = await VerificationKeys.deploy();
  await verificationKeys.waitForDeployment();
  const vkeysAddress = await verificationKeys.getAddress();
  console.log("✅ InnocenceVerificationKeys deployed to:", vkeysAddress);
  
  // Deploy main contract
  console.log("\n3. Deploying HyperliquidPrivacySystemV5...");
  
  // Use deployer as compliance authority for now
  const complianceAuthority = deployer.address;
  console.log("Using deployer as compliance authority:", complianceAuthority);
  
  const HyperliquidPrivacySystem = await hre.ethers.getContractFactory("HyperliquidPrivacySystemV5");
  const privacySystem = await HyperliquidPrivacySystem.deploy(
    mockVerifierAddress,
    complianceAuthority
  );
  await privacySystem.waitForDeployment();
  const privacySystemAddress = await privacySystem.getAddress();
  console.log("✅ HyperliquidPrivacySystemV5 deployed to:", privacySystemAddress);
  
  // Deploy TransferHelper
  console.log("\n4. Deploying HyperliquidTransferHelper...");
  const TransferHelper = await hre.ethers.getContractFactory("HyperliquidTransferHelper");
  const transferHelper = await TransferHelper.deploy();
  await transferHelper.waitForDeployment();
  const transferHelperAddress = await transferHelper.getAddress();
  console.log("✅ HyperliquidTransferHelper deployed to:", transferHelperAddress);
  
  // Save deployment info
  const deployment = {
    network: "hyperevm_mainnet",
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    warning: "USING MOCK VERIFIER - REPLACE BEFORE PRODUCTION USE",
    contracts: {
      mockSP1Verifier: mockVerifierAddress,
      verificationKeys: vkeysAddress,
      privacySystem: privacySystemAddress,
      transferHelper: transferHelperAddress,
      complianceAuthority: complianceAuthority
    },
    config: {
      maxDepositAmount: config.features.maxDepositAmount,
      depositTimeout: config.features.depositTimeout,
      withdrawalDelay: config.features.withdrawalDelay
    }
  };
  
  const deploymentPath = path.join(__dirname, '../deployments/mainnet-mock-deployment.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("\n✅ Deployment info saved to:", deploymentPath);
  
  console.log("\n🎉 Mainnet deployment complete!");
  console.log("\n⚠️  CRITICAL REMINDERS:");
  console.log("1. This uses a MOCK verifier - DO NOT use for production funds");
  console.log("2. Replace with real SP1 verifier before accepting user deposits");
  console.log("3. Update compliance authority to a multisig wallet");
  console.log("4. Test all functions with small amounts first");
  console.log("5. Monitor the contracts closely");
  
  console.log("\n📋 Next steps:");
  console.log("1. Update frontend config with these addresses");
  console.log("2. Test deposit/withdrawal flow with small amounts");
  console.log("3. Contact Succinct Labs about SP1 verifier deployment");
  console.log("4. Plan migration to real verifier when available");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });