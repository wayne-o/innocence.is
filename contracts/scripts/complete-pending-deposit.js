const { ethers } = require("hardhat");

async function main() {
    const contractAddress = "0x38957E2052AfFff204C4EA8Ae88cDA805C58B7b9";
    
    console.log("=== Completing Pending Deposit ===");
    console.log("Contract:", contractAddress);
    
    try {
        const [deployer] = await ethers.getSigners();
        console.log("User:", deployer.address);
        
        const HyperliquidPrivacySystemEVMWithRecovery = await ethers.getContractFactory("HyperliquidPrivacySystemEVMWithRecovery");
        const contract = HyperliquidPrivacySystemEVMWithRecovery.attach(contractAddress);
        
        // Check current state
        const contractBalance = await ethers.provider.getBalance(contractAddress);
        const pendingDeposit = await contract.getPendingDeposit(deployer.address);
        const canComplete = await contract.canCompleteDeposit(deployer.address);
        
        console.log("Contract balance:", ethers.formatEther(contractBalance), "ETH");
        console.log("Pending amount:", ethers.formatEther(pendingDeposit.amount), "ETH");
        console.log("Can complete:", canComplete);
        
        if (!canComplete) {
            console.log("❌ Cannot complete deposit - not ready");
            return;
        }
        
        if (pendingDeposit.completed) {
            console.log("✅ Deposit already completed");
            return;
        }
        
        console.log("\n=== Generating ZK Proof for Completion ===");
        
        // Generate a mock commitment and proof
        const commitment = ethers.keccak256(ethers.toUtf8Bytes("completion_commitment_" + Date.now()));
        console.log("Commitment:", commitment);
        
        // Create mock compliance proof (works with mock verifier)
        const mockProof = "0x" + "ab".repeat(64); // 64 bytes
        
        // Create compliance proof public values
        const compliancePublicValues = ethers.AbiCoder.defaultAbiCoder().encode(
            ["bytes32", "address", "uint256", "bytes32"],
            [
                commitment,
                deployer.address, // compliance authority
                Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // valid for 1 year
                ethers.keccak256(ethers.toUtf8Bytes("deposit_completion_certificate"))
            ]
        );
        
        console.log("Mock proof generated");
        
        console.log("\n=== Completing Deposit ===");
        
        try {
            const completeTx = await contract.completeDeposit(
                commitment,
                mockProof,
                compliancePublicValues
            );
            
            console.log("Complete deposit tx:", completeTx.hash);
            console.log("Waiting for confirmation...");
            
            const receipt = await completeTx.wait();
            console.log("✅ DEPOSIT COMPLETED SUCCESSFULLY!");
            console.log("Block:", receipt.blockNumber);
            console.log("Gas used:", receipt.gasUsed.toString());
            
            // Check final state
            const finalPending = await contract.getPendingDeposit(deployer.address);
            const finalBalance = await ethers.provider.getBalance(contractAddress);
            
            console.log("\n=== Final State ===");
            console.log("Contract balance:", ethers.formatEther(finalBalance), "ETH");
            console.log("Deposit completed:", finalPending.completed);
            
            // Check events
            console.log("\n=== Events ===");
            for (const log of receipt.logs) {
                try {
                    const parsed = contract.interface.parseLog(log);
                    if (parsed && parsed.name === 'PrivateDeposit') {
                        console.log("PrivateDeposit event:");
                        console.log("- Commitment:", parsed.args.commitment);
                        console.log("- Timestamp:", new Date(Number(parsed.args.timestamp) * 1000).toISOString());
                    }
                } catch (e) {
                    // Ignore non-contract logs
                }
            }
            
            console.log("\n🎉 SUCCESS! Your deposit is now private and committed!");
            console.log("💾 Commitment:", commitment);
            console.log("🔐 Use this commitment for future withdrawals");
            
        } catch (completeError) {
            console.log("❌ Complete deposit failed:", completeError.message);
            
            if (completeError.message.includes("No valid pending deposit")) {
                console.log("The pending deposit may have been cleared or completed already");
            } else if (completeError.message.includes("Commitment already used")) {
                console.log("This commitment was already used - try again with a new one");
            }
        }
        
    } catch (error) {
        console.error("Error:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });