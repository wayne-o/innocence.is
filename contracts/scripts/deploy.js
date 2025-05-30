const hre = require("hardhat");

async function main() {
  console.log("Deploying HyperliquidPrivacySystem...");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // For now, the deployer will act as the compliance authority
  // In production, this should be a separate secure address
  const complianceAuthorityAddress = deployer.address;

  // Deploy the HyperliquidPrivacySystem contract
  const HyperliquidPrivacySystem = await hre.ethers.getContractFactory("HyperliquidPrivacySystem");
  const privacySystem = await HyperliquidPrivacySystem.deploy(complianceAuthorityAddress);

  await privacySystem.deployed();

  console.log("HyperliquidPrivacySystem deployed to:", privacySystem.address);
  console.log("Compliance authority set to:", complianceAuthorityAddress);

  // Verify contract on explorer (if not on localhost)
  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    console.log("Waiting for block confirmations...");
    await privacySystem.deployTransaction.wait(5);
    
    console.log("Verifying contract...");
    try {
      await hre.run("verify:verify", {
        address: privacySystem.address,
        constructorArguments: [complianceAuthorityAddress],
      });
    } catch (error) {
      console.error("Error verifying contract:", error);
    }
  }

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: privacySystem.address,
    complianceAuthority: complianceAuthorityAddress,
    deploymentTime: new Date().toISOString(),
    deployer: deployer.address,
  };

  fs.writeFileSync(
    `./deployments/${hre.network.name}-deployment.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("Deployment info saved to deployments folder");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });