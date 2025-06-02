const hre = require("hardhat");
const fs = require("fs");

// SP1 Verifier addresses on different networks
// See: https://github.com/succinctlabs/sp1-contracts/tree/main/contracts/deployments
const SP1_VERIFIER_ADDRESSES = {
  "hyperevm_testnet": "0x3B6041173B80E77f038f3F2C0f9744f04837185e", // Using Sepolia address as placeholder
  "localhost": "0x0000000000000000000000000000000000000000" // Will need to deploy locally
};

async function main() {
  console.log("Deploying HyperliquidPrivacySystemV4...");

  const network = hre.network.name;
  console.log(`Network: ${network}`);

  let sp1VerifierAddress = SP1_VERIFIER_ADDRESSES[network];
  
  // If SP1 verifier not deployed on this network, deploy a mock
  if (!sp1VerifierAddress || sp1VerifierAddress === "0x0000000000000000000000000000000000000000") {
    console.log("Deploying MockSP1Verifier...");
    const MockSP1Verifier = await hre.ethers.getContractFactory("MockSP1Verifier");
    const mockVerifier = await MockSP1Verifier.deploy();
    await mockVerifier.waitForDeployment();
    sp1VerifierAddress = await mockVerifier.getAddress();
    console.log("MockSP1Verifier deployed to:", sp1VerifierAddress);
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance));

  // Deploy the privacy system
  const HyperliquidPrivacySystemV4 = await hre.ethers.getContractFactory("HyperliquidPrivacySystemV4");
  const contract = await HyperliquidPrivacySystemV4.deploy(
    sp1VerifierAddress,
    deployer.address // Compliance authority
  );

  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  
  console.log("HyperliquidPrivacySystemV4 deployed to:", contractAddress);
  console.log("SP1 Verifier:", sp1VerifierAddress);
  console.log("Compliance Authority:", deployer.address);

  // Save deployment info
  const deploymentInfo = {
    network: network,
    contract: "HyperliquidPrivacySystemV4",
    address: contractAddress,
    sp1Verifier: sp1VerifierAddress,
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

  const filename = `deployments/${network}-v4-deployment.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Deployment info saved to ${filename}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });