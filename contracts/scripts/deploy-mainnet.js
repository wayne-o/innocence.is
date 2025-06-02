const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

// Load mainnet configuration
const config = require('../../config/mainnet.json');

async function main() {
  console.log("🚀 Starting Innocence mainnet deployment...");
  
  // Mainnet safety checks
  const chainId = await hre.ethers.provider.getNetwork().then(n => n.chainId);
  if (chainId !== 999n) { // Hyperliquid mainnet chain ID
    throw new Error(`Wrong network! Expected mainnet (999), got ${chainId}`);
  }
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "HYPE");
  
  // Safety confirmation
  console.log("\n⚠️  MAINNET DEPLOYMENT CONFIRMATION ⚠️");
  console.log("You are about to deploy to MAINNET. This action cannot be undone.");
  console.log("Please verify:");
  console.log("- SP1 Verifier address is correct");
  console.log("- Compliance authority address is correct");
  console.log("- You have tested everything on testnet");
  console.log("\nPress Ctrl+C to abort. Waiting 10 seconds...");
  
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Deploy InnocenceVerificationKeys
  console.log("\n1. Deploying InnocenceVerificationKeys...");
  const VerificationKeys = await hre.ethers.getContractFactory("InnocenceVerificationKeys");
  const verificationKeys = await VerificationKeys.deploy();
  await verificationKeys.waitForDeployment();
  const vkeysAddress = await verificationKeys.getAddress();
  console.log("✅ InnocenceVerificationKeys deployed to:", vkeysAddress);
  
  // Verify the verification keys are set correctly
  const ownershipVkey = await verificationKeys.OWNERSHIP_VKEY();
  const balanceVkey = await verificationKeys.BALANCE_VKEY();
  const complianceVkey = await verificationKeys.COMPLIANCE_VKEY();
  const tradeVkey = await verificationKeys.TRADE_VKEY();
  
  console.log("\nVerification keys:");
  console.log("- Ownership:", ownershipVkey);
  console.log("- Balance:", balanceVkey);
  console.log("- Compliance:", complianceVkey);
  console.log("- Trade:", tradeVkey);
  
  // Deploy main contract
  console.log("\n2. Deploying HyperliquidPrivacySystem...");
  
  if (!config.contracts.sp1Verifier || config.contracts.sp1Verifier === "0x0000000000000000000000000000000000000000") {
    throw new Error("SP1 Verifier address not configured for mainnet!");
  }
  
  if (!config.contracts.complianceAuthority || config.contracts.complianceAuthority === "0x0000000000000000000000000000000000000000") {
    throw new Error("Compliance authority address not configured for mainnet!");
  }
  
  const HyperliquidPrivacySystem = await hre.ethers.getContractFactory("HyperliquidPrivacySystemV6");
  const privacySystem = await HyperliquidPrivacySystem.deploy(
    config.contracts.sp1Verifier,
    config.contracts.complianceAuthority
  );
  await privacySystem.waitForDeployment();
  const privacySystemAddress = await privacySystem.getAddress();
  console.log("✅ HyperliquidPrivacySystem deployed to:", privacySystemAddress);
  
  // Deploy TransferHelper
  console.log("\n3. Deploying HyperliquidTransferHelper...");
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
    contracts: {
      verificationKeys: vkeysAddress,
      privacySystem: privacySystemAddress,
      transferHelper: transferHelperAddress,
      sp1Verifier: config.contracts.sp1Verifier,
      complianceAuthority: config.contracts.complianceAuthority
    },
    verificationKeys: {
      ownership: ownershipVkey,
      balance: balanceVkey,
      compliance: complianceVkey,
      trade: tradeVkey
    },
    config: {
      maxDepositAmount: config.features.maxDepositAmount,
      depositTimeout: config.features.depositTimeout,
      withdrawalDelay: config.features.withdrawalDelay
    }
  };
  
  const deploymentPath = path.join(__dirname, '../deployments/mainnet-deployment.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("\n✅ Deployment info saved to:", deploymentPath);
  
  // Verify contracts on explorer
  console.log("\n4. Preparing contract verification...");
  console.log("Run the following commands to verify contracts:");
  console.log(`npx hardhat verify --network hyperevm_mainnet ${vkeysAddress}`);
  console.log(`npx hardhat verify --network hyperevm_mainnet ${privacySystemAddress} ${config.contracts.sp1Verifier} ${config.contracts.complianceAuthority}`);
  console.log(`npx hardhat verify --network hyperevm_mainnet ${transferHelperAddress}`);
  
  console.log("\n🎉 Mainnet deployment complete!");
  console.log("\n⚠️  IMPORTANT NEXT STEPS:");
  console.log("1. Verify all contracts on the explorer");
  console.log("2. Transfer ownership to multisig wallet");
  console.log("3. Update frontend configuration");
  console.log("4. Test with small amounts first");
  console.log("5. Monitor contract events and balances");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });