const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    
    console.log("Deploying Pure EVM Privacy System...");
    console.log("Deployer:", deployer.address);
    
    // Use existing mock verifier and compliance authority
    const mockVerifierAddress = "0xC55664b68E495Cd32BFFdAf53b881a60A5baCfd5";
    const complianceAuthority = "0x5Bd2F329C50860366c0E6D3b4227a422B66AD203";
    
    console.log("Using mock SP1 verifier:", mockVerifierAddress);
    console.log("Compliance authority:", complianceAuthority);
    
    // Deploy the pure EVM privacy system
    const HyperliquidPrivacySystemEVM = await ethers.getContractFactory("HyperliquidPrivacySystemEVM");
    const privacySystem = await HyperliquidPrivacySystemEVM.deploy(
        mockVerifierAddress,
        complianceAuthority
    );
    
    await privacySystem.waitForDeployment();
    const contractAddress = await privacySystem.getAddress();
    
    console.log("✅ HyperliquidPrivacySystemEVM deployed to:", contractAddress);
    
    // For testing, we'll map token ID 150 to the native currency (ETH-like)
    // In production, you'd map to actual ERC20 token addresses
    console.log("\nSetting up token mapping...");
    
    // Token 150 (HYPE) → Native currency for simplicity
    // In a real deployment, you'd use actual ERC20 addresses
    
    const deployment = {
        network: "hyperevm_mainnet",
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        type: "PURE_EVM_PRIVACY_SYSTEM",
        contracts: {
            mockSP1Verifier: mockVerifierAddress,
            privacySystemEVM: contractAddress,
            complianceAuthority: complianceAuthority
        },
        tokenMappings: {
            "0": "0x0000000000000000000000000000000000000000", // Native ETH
            "150": "NATIVE" // HYPE mapped to native currency for testing
        },
        config: {
            maxDepositAmount: "1000000000000000000", // 1 ETH equivalent
            depositTimeout: 1800,
            withdrawalDelay: 0 // No delay for EVM transfers
        }
    };
    
    // Save deployment info
    const fs = require('fs');
    const path = require('path');
    const deploymentPath = path.join(__dirname, '../deployments/pure-evm-deployment.json');
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    
    console.log("\n=== Deployment Summary ===");
    console.log("Privacy System (EVM):", contractAddress);
    console.log("Mock Verifier:", mockVerifierAddress);
    console.log("Architecture: Pure EVM (no L1 integration)");
    console.log("Deployment saved to:", deploymentPath);
    
    console.log("\n=== Next Steps ===");
    console.log("1. Update frontend to use the new contract address");
    console.log("2. Test deposits with native currency");
    console.log("3. Test withdrawals (should work without sendSpot issues)");
    console.log("4. Add ERC20 token mappings as needed");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });