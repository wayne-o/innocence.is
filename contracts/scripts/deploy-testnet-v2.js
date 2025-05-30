const hre = require("hardhat");

async function main() {
  console.log("Deploying Testnet Version to Hyperliquid Testnet...");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  
  // Get account balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

  // For testnet, the deployer will act as the compliance authority
  // In production, this should be a separate secure address
  const complianceAuthorityAddress = deployer.address;

  // Deploy the HyperliquidPrivacySystemTestnet contract
  console.log("\nDeploying HyperliquidPrivacySystemTestnet...");
  const HyperliquidPrivacySystemTestnet = await hre.ethers.getContractFactory("HyperliquidPrivacySystemTestnet");
  const privacySystem = await HyperliquidPrivacySystemTestnet.deploy(complianceAuthorityAddress);

  await privacySystem.waitForDeployment();
  const contractAddress = await privacySystem.getAddress();

  console.log("HyperliquidPrivacySystemTestnet deployed to:", contractAddress);
  console.log("Compliance authority set to:", complianceAuthorityAddress);

  // Validate a test certificate for the deployer
  console.log("\nValidating test certificate for deployer...");
  const tx = await privacySystem.validateCertificate(
    deployer.address,
    "0x00", // dummy certificate
    "0x00"  // dummy signature
  );
  await tx.wait();
  console.log("Test certificate validated!");

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: contractAddress,
    contractName: "HyperliquidPrivacySystemTestnet",
    complianceAuthority: complianceAuthorityAddress,
    deploymentTime: new Date().toISOString(),
    deployer: deployer.address,
    chainId: 998,
    rpcUrl: "https://rpc.hyperliquid-testnet.xyz/evm"
  };

  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
  }

  fs.writeFileSync(
    `./deployments/${hre.network.name}-testnet-v2-deployment.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\nDeployment complete!");
  console.log("=====================================");
  console.log("Contract Address:", contractAddress);
  console.log("=====================================");
  
  console.log("\nNext steps:");
  console.log("1. Update frontend .env:");
  console.log(`   REACT_APP_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`   REACT_APP_RPC_URL=https://rpc.hyperliquid-testnet.xyz/evm`);
  console.log("\n2. Configure MetaMask:");
  console.log("   Network Name: Hyperliquid Testnet");
  console.log("   RPC URL: https://rpc.hyperliquid-testnet.xyz/evm");
  console.log("   Chain ID: 998");
  console.log("   Currency Symbol: ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });