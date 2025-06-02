const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    
    console.log("=== Deploying Recovery-Enabled Privacy System ===");
    console.log("Deployer:", deployer.address);
    
    // Use existing mock verifier
    const mockVerifierAddress = "0xC55664b68E495Cd32BFFdAf53b881a60A5baCfd5";
    const complianceAuthority = deployer.address;
    
    console.log("Using mock SP1 verifier:", mockVerifierAddress);
    console.log("Compliance authority:", complianceAuthority);
    
    // Deploy the recovery-enabled privacy system
    const HyperliquidPrivacySystemEVMWithRecovery = await ethers.getContractFactory("HyperliquidPrivacySystemEVMWithRecovery");
    const privacySystem = await HyperliquidPrivacySystemEVMWithRecovery.deploy(
        mockVerifierAddress,
        complianceAuthority
    );
    
    await privacySystem.waitForDeployment();
    const contractAddress = await privacySystem.getAddress();
    
    console.log("✅ HyperliquidPrivacySystemEVMWithRecovery deployed to:", contractAddress);
    
    const deployment = {
        network: "hyperevm_mainnet",
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        type: "PURE_EVM_PRIVACY_SYSTEM_WITH_RECOVERY",
        contracts: {
            mockSP1Verifier: mockVerifierAddress,
            privacySystemEVMWithRecovery: contractAddress,
            complianceAuthority: complianceAuthority
        },
        emergencyFunctions: {
            emergencyWithdraw: "emergencyWithdraw(address,uint64,uint256,string)",
            emergencyWithdrawAll: "emergencyWithdrawAll(address,string)"
        }
    };
    
    // Save deployment info
    const fs = require('fs');
    const path = require('path');
    const deploymentPath = path.join(__dirname, '../deployments/recovery-system-deployment.json');
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    
    console.log("\n=== Deployment Summary ===");
    console.log("Recovery System:", contractAddress);
    console.log("Emergency Functions Available:");
    console.log("- emergencyWithdraw(address, uint64, uint256, string)");
    console.log("- emergencyWithdrawAll(address, string)");
    console.log("Only callable by compliance authority:", complianceAuthority);
    
    console.log("\n=== Next Steps for Asset Recovery ===");
    console.log("1. The new contract has emergency withdrawal functions");
    console.log("2. You can now use this contract for future deposits");
    console.log("3. For the locked assets in the old contract, we need a different approach");
    console.log("4. Since you're the compliance authority, let's create a recovery script");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });