const hre = require("hardhat");

async function main() {
  console.log("🔍 Checking deployment readiness...\n");
  
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  
  console.log("Network Information:");
  console.log("- Chain ID:", network.chainId.toString());
  console.log("- Network Name:", hre.network.name);
  console.log("- RPC URL:", hre.network.config.url);
  
  console.log("\nDeployer Information:");
  console.log("- Address:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("- Balance:", hre.ethers.formatEther(balance), "HYPE");
  
  // Check if balance is sufficient
  const minRequired = hre.ethers.parseEther("0.1");
  if (balance >= minRequired) {
    console.log("✅ Sufficient balance for deployment");
  } else {
    console.log("❌ Insufficient balance for deployment");
    console.log(`   Need at least ${hre.ethers.formatEther(minRequired)} HYPE`);
    
    console.log("\n📋 How to get HYPE on HyperEVM:");
    console.log("1. Go to app.hyperliquid.xyz");
    console.log("2. Connect your wallet");
    console.log("3. Navigate to 'Bridge' or 'Transfer'");
    console.log("4. Transfer HYPE from L1 to EVM");
    console.log(`5. Send to your deployer address: ${deployer.address}`);
    console.log("\nAlternatively:");
    console.log("- Use the Hyperliquid CLI or API to transfer");
    console.log("- Ask someone to send you HYPE for gas");
  }
  
  // Estimate deployment costs
  console.log("\n💰 Estimated Deployment Costs:");
  console.log("- MockSP1Verifier: ~0.005 HYPE");
  console.log("- InnocenceVerificationKeys: ~0.01 HYPE");
  console.log("- HyperliquidPrivacySystemV5: ~0.02 HYPE");
  console.log("- HyperliquidTransferHelper: ~0.005 HYPE");
  console.log("- Total Estimated: ~0.04 HYPE");
  console.log("- Recommended: 0.1 HYPE (for safety margin)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });