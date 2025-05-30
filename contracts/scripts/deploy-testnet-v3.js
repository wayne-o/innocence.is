const hre = require("hardhat");

async function main() {
  console.log("Deploying HyperliquidPrivacySystemV3 to Hyperliquid Testnet...");
  console.log("This version uses the correct precompile interfaces\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance));

  // Deploy the V3 contract with correct precompile support
  console.log("\nDeploying HyperliquidPrivacySystemV3...");
  const HyperliquidPrivacySystemV3 = await hre.ethers.getContractFactory("HyperliquidPrivacySystemV3");
  const privacySystem = await HyperliquidPrivacySystemV3.deploy(
    deployer.address // compliance authority
  );

  await privacySystem.waitForDeployment();
  const contractAddress = await privacySystem.getAddress();
  
  console.log("HyperliquidPrivacySystemV3 deployed to:", contractAddress);

  // Validate a test certificate for the deployer
  console.log("\nValidating test certificate for deployer...");
  try {
    const tx = await privacySystem.validateCertificate(
      deployer.address,
      "0x00", // dummy certificate
      "0x00"  // dummy signature
    );
    await tx.wait();
    console.log("Certificate validated successfully!");
  } catch (error) {
    console.error("Failed to validate certificate:", error.message);
  }

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: "hyperevm_testnet",
    contractAddress: contractAddress,
    contractVersion: "V3",
    complianceAuthority: deployer.address,
    deploymentTime: new Date().toISOString(),
    deployer: deployer.address,
    precompiles: {
      position: "0x0000000000000000000000000000000000000800",
      spotBalance: "0x0000000000000000000000000000000000000801",
      oraclePx: "0x0000000000000000000000000000000000000807",
      spotPx: "0x0000000000000000000000000000000000000808",
      write: "0x3333333333333333333333333333333333333333"
    },
    notes: "Uses correct HyperCore precompile interfaces with proper data types"
  };

  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
  }

  fs.writeFileSync(
    "./deployments/hyperevm_testnet-v3-deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\nDeployment complete!");
  console.log("Contract Address:", contractAddress);
  console.log("\nIMPORTANT: This contract uses the HyperCore precompiles:");
  console.log("- Oracle prices use uint64 format");
  console.log("- Token IDs are uint64");
  console.log("- Asset IDs for perps are uint32");
  console.log("- All amounts are in wei (uint64)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });