const { ethers } = require("hardhat");

async function main() {
    const contractAddress = "0x38957E2052AfFff204C4EA8Ae88cDA805C58B7b9";
    
    console.log("=== Fixing Overflow Issue ===");
    console.log("Contract:", contractAddress);
    
    try {
        const [deployer] = await ethers.getSigners();
        console.log("User:", deployer.address);
        
        const HyperliquidPrivacySystemEVMWithRecovery = await ethers.getContractFactory("HyperliquidPrivacySystemEVMWithRecovery");
        const contract = HyperliquidPrivacySystemEVMWithRecovery.attach(contractAddress);
        
        // Check current state
        const contractBalance = await ethers.provider.getBalance(contractAddress);
        console.log("Current contract balance:", ethers.formatEther(contractBalance), "ETH");
        
        try {
            const pendingDeposit = await contract.getPendingDeposit(deployer.address);
            console.log("Corrupted pending deposit:");
            console.log("- Amount:", ethers.formatEther(pendingDeposit.amount), "ETH");
            console.log("- Balance before:", ethers.formatEther(pendingDeposit.contractBalanceBefore), "ETH");
            console.log("- Current balance:", ethers.formatEther(contractBalance), "ETH");
            console.log("- This causes overflow:", ethers.formatEther(contractBalance), "-", ethers.formatEther(pendingDeposit.contractBalanceBefore), "= negative number");
        } catch (e) {
            console.log("Cannot read pending deposit due to overflow");
        }
        
        console.log("\n=== Solution: Clear and Recreate Deposit ===");
        
        // The solution is to create a new pending deposit that overwrites the corrupted one
        // We'll prepare a deposit that matches the current contract balance
        
        const validDepositAmount = contractBalance; // Use the full current balance
        console.log("Creating valid deposit for:", ethers.formatEther(validDepositAmount), "ETH");
        
        if (validDepositAmount > 0) {
            console.log("1. Preparing fresh deposit to clear corrupted state...");
            
            const prepareTx = await contract.prepareDeposit(0, validDepositAmount);
            console.log("Prepare tx:", prepareTx.hash);
            await prepareTx.wait();
            
            console.log("2. Checking if the overflow is fixed...");
            
            try {
                const canComplete = await contract.canCompleteDeposit(deployer.address);
                console.log("Can complete deposit:", canComplete);
                
                if (canComplete) {
                    console.log("✅ OVERFLOW FIXED! Deposit can now be completed");
                    
                    console.log("3. Completing the deposit...");
                    
                    const commitment = ethers.keccak256(ethers.toUtf8Bytes("fixed_deposit_" + Date.now()));
                    const mockProof = "0x" + "ef".repeat(64);
                    
                    const compliancePublicValues = ethers.AbiCoder.defaultAbiCoder().encode(
                        ["bytes32", "address", "uint256", "bytes32"],
                        [
                            commitment,
                            deployer.address,
                            Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
                            ethers.keccak256(ethers.toUtf8Bytes("overflow_fix_certificate"))
                        ]
                    );
                    
                    const completeTx = await contract.completeDeposit(
                        commitment,
                        mockProof,
                        compliancePublicValues
                    );
                    
                    console.log("Complete tx:", completeTx.hash);
                    const receipt = await completeTx.wait();
                    
                    console.log("🎉 DEPOSIT COMPLETED SUCCESSFULLY!");
                    console.log("💾 Commitment:", commitment);
                    console.log("Block:", receipt.blockNumber);
                    
                } else {
                    console.log("❌ Still cannot complete - may need additional ETH");
                    
                    // Check the new state
                    const newPending = await contract.getPendingDeposit(deployer.address);
                    console.log("New pending state:");
                    console.log("- Amount:", ethers.formatEther(newPending.amount), "ETH");
                    console.log("- Balance before:", ethers.formatEther(newPending.contractBalanceBefore), "ETH");
                }
                
            } catch (checkError) {
                console.log("❌ Overflow still exists:", checkError.message);
                console.log("May need emergency withdrawal to completely reset contract state");
            }
            
        } else {
            console.log("Contract balance is 0 - no deposit to fix");
        }
        
        console.log("\n=== Final State ===");
        const finalBalance = await ethers.provider.getBalance(contractAddress);
        console.log("Final contract balance:", ethers.formatEther(finalBalance), "ETH");
        
        if (finalBalance === BigInt(0)) {
            console.log("✅ Contract is clean - ready for fresh deposits");
        }
        
    } catch (error) {
        console.error("Error:", error.message);
        
        if (error.message.includes("overflow")) {
            console.log("\n💡 Alternative solution: Emergency withdraw all funds to completely reset");
            console.log("This will clear all pending deposits and reset the contract state");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });