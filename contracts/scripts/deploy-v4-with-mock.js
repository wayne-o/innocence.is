const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Deploying HyperliquidPrivacySystemV4 with MockSP1Verifier...");

  const network = hre.network.name;
  console.log(`Network: ${network}`);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance));

  // Deploy MockSP1Verifier first
  console.log("\nDeploying MockSP1Verifier...");
  const MockSP1Verifier = await hre.ethers.getContractFactory("MockSP1Verifier");
  const mockVerifier = await MockSP1Verifier.deploy();
  await mockVerifier.waitForDeployment();
  const mockVerifierAddress = await mockVerifier.getAddress();
  console.log("MockSP1Verifier deployed to:", mockVerifierAddress);

  // Deploy the privacy system
  console.log("\nDeploying HyperliquidPrivacySystemV4...");
  const HyperliquidPrivacySystemV4 = await hre.ethers.getContractFactory("HyperliquidPrivacySystemV4");
  const contract = await HyperliquidPrivacySystemV4.deploy(
    mockVerifierAddress,
    deployer.address // Compliance authority
  );

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  
  console.log("HyperliquidPrivacySystemV4 deployed to:", contractAddress);
  console.log("MockSP1Verifier:", mockVerifierAddress);
  console.log("Compliance Authority:", deployer.address);

  // Save deployment info
  const deploymentInfo = {
    network: network,
    contract: "HyperliquidPrivacySystemV4",
    address: contractAddress,
    mockSP1Verifier: mockVerifierAddress,
    complianceAuthority: deployer.address,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    verificationKeys: {
      ownership: "0x006bf06179a19e1575731cbb10c5b9cc955cae6f0a5de98cf8baf3c7c416131a",
      balance: "0x009c22b4f95fb710070dc80cfce7526c4cc7780834ab328bd769ff58934e6d05",
      compliance: "0x00ed1611619b8f2866de7be17d81a9d42a869b4c5959629708f125ae34a2f9ee",
      trade: "0x008484840d42565b9589f5c37253789d3731407964b1537fb5cf9d6064226b1c"
    }
  };

  const filename = `deployments/${network}-v4-mock-deployment.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to ${filename}`);
  
  console.log("\n🎉 Deployment complete!");
  console.log("\nUpdate your frontend .env file:");
  console.log(`REACT_APP_CONTRACT_ADDRESS=${contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });