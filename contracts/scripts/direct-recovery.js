const { ethers } = require("hardhat");

async function main() {
    const lockedContractAddress = "0x60564ff628987871EFFF0A2Ec8b6EF722895152e";
    
    console.log("=== DIRECT ASSET RECOVERY ===");
    console.log("Locked contract:", lockedContractAddress);
    
    try {
        const [deployer] = await ethers.getSigners();
        console.log("Authority:", deployer.address);
        
        const lockedBalance = await ethers.provider.getBalance(lockedContractAddress);
        console.log("Locked ETH:", ethers.formatEther(lockedBalance), "ETH");
        
        // Load the locked contract
        const HyperliquidPrivacySystemEVM = await ethers.getContractFactory("HyperliquidPrivacySystemEVM");
        const lockedContract = HyperliquidPrivacySystemEVM.attach(lockedContractAddress);
        
        // Check our authority status
        const complianceAuthority = await lockedContract.complianceAuthority();
        console.log("Compliance authority:", complianceAuthority);
        console.log("Are you authorized?", deployer.address.toLowerCase() === complianceAuthority.toLowerCase());
        
        if (deployer.address.toLowerCase() !== complianceAuthority.toLowerCase()) {
            console.log("❌ You are not the compliance authority - cannot perform recovery");
            return;
        }
        
        console.log("\n=== Recovery Options ===");
        
        // Option 1: Try to complete the pending deposit to unlock ETH
        console.log("Option 1: Complete pending deposit to unlock ETH");
        const pendingDeposit = await lockedContract.getPendingDeposit(deployer.address);
        console.log("Pending deposit:", {
            amount: ethers.formatEther(pendingDeposit.amount),
            completed: pendingDeposit.completed,
            timestamp: new Date(Number(pendingDeposit.timestamp) * 1000).toISOString()
        });
        
        if (pendingDeposit.timestamp > 0 && !pendingDeposit.completed) {
            console.log("✅ Found pending deposit to complete");
            
            // Try to complete with minimal proof
            const commitment = ethers.keccak256(ethers.toUtf8Bytes("recovery_commitment"));
            
            // Create a minimal proof that might work with mock verifier
            const mockProof = "0x" + "ab".repeat(64); // 64 bytes of 0xab
            
            const compliancePublicValues = ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes32", "address", "uint256", "bytes32"],
                [
                    commitment,
                    deployer.address,
                    Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
                    ethers.keccak256(ethers.toUtf8Bytes("emergency_recovery"))
                ]
            );
            
            try {
                console.log("Attempting to complete deposit...");
                const completeTx = await lockedContract.completeDeposit(
                    commitment,
                    mockProof,
                    compliancePublicValues
                );
                console.log("Complete deposit tx:", completeTx.hash);
                await completeTx.wait();
                console.log("✅ Deposit completed successfully!");
                
                // Now we can try to withdraw
                console.log("\nAttempting withdrawal after deposit completion...");
                
            } catch (completeError) {
                console.log("❌ Complete deposit failed:", completeError.message);
            }
        }
        
        // Option 2: Create a withdrawal using the existing withdraw function
        console.log("\nOption 2: Direct withdrawal with mock proof");
        
        const nullifier = ethers.keccak256(ethers.toUtf8Bytes("emergency_nullifier_" + Date.now()));
        const withdrawAmount = lockedBalance;
        
        const mockBalanceProof = "0x" + "cd".repeat(64); // Different pattern
        
        // Mock balance proof public values
        const balancePublicValues = ethers.AbiCoder.defaultAbiCoder().encode(
            ["bytes32", "bytes32", "uint256", "uint64"],
            [
                ethers.keccak256(ethers.toUtf8Bytes("mock_commitment")),
                await lockedContract.getMerkleRoot(), // Use actual merkle root
                withdrawAmount,
                0 // ETH token ID
            ]
        );
        
        try {
            console.log("Attempting emergency withdrawal...");
            console.log("Amount:", ethers.formatEther(withdrawAmount), "ETH");
            
            const withdrawTx = await lockedContract.withdraw(
                nullifier,
                deployer.address,
                0, // ETH
                withdrawAmount,
                mockBalanceProof,
                balancePublicValues
            );
            
            console.log("Withdrawal tx:", withdrawTx.hash);
            await withdrawTx.wait();
            console.log("✅ EMERGENCY WITHDRAWAL SUCCESSFUL!");
            
        } catch (withdrawError) {
            console.log("❌ Withdrawal failed:", withdrawError.message);
            
            // Option 3: Force contract interaction to trigger receive/fallback
            console.log("\nOption 3: Force contract state change");
            
            try {
                // Try to send a small amount to trigger receive() function
                const triggerTx = await deployer.sendTransaction({
                    to: lockedContractAddress,
                    value: 1, // 1 wei
                    data: "0x00", // Trigger fallback with data
                    gasLimit: 100000
                });
                
                console.log("Trigger tx:", triggerTx.hash);
                await triggerTx.wait();
                
                const newBalance = await ethers.provider.getBalance(lockedContractAddress);
                console.log("New contract balance:", ethers.formatEther(newBalance), "ETH");
                
            } catch (triggerError) {
                console.log("❌ Trigger failed:", triggerError.message);
            }
        }
        
        // Final check
        const finalBalance = await ethers.provider.getBalance(lockedContractAddress);
        console.log("\n=== Final Status ===");
        console.log("Contract balance:", ethers.formatEther(finalBalance), "ETH");
        
        if (finalBalance < lockedBalance) {
            console.log("✅ Successfully recovered", ethers.formatEther(lockedBalance - finalBalance), "ETH");
        } else {
            console.log("❌ Assets still locked");
            console.log("\n=== Alternative Solutions ===");
            console.log("1. Deploy new contract with emergency functions (done)");
            console.log("2. Use the new contract for future operations");
            console.log("3. Consider the locked ETH as 'donation' to the ecosystem");
            console.log("4. The new recovery contract address:", "0x38957E2052AfFff204C4EA8Ae88cDA805C58B7b9");
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