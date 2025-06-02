const { ethers } = require("hardhat");

async function main() {
    const contractAddress = "0x60564ff628987871EFFF0A2Ec8b6EF722895152e";
    const userAddress = "0xA8b90cEf0e388a23Cf2d3625481ce14D7c53750D";
    
    console.log("=== Fixing EVM Deposit Issue ===");
    console.log("Contract:", contractAddress);
    console.log("User:", userAddress);
    
    try {
        const HyperliquidPrivacySystemEVM = await ethers.getContractFactory("HyperliquidPrivacySystemEVM");
        const contract = HyperliquidPrivacySystemEVM.attach(contractAddress);
        
        console.log("\n=== Current State ===");
        const contractBalance = await ethers.provider.getBalance(contractAddress);
        console.log("Contract ETH balance:", ethers.formatEther(contractBalance), "ETH");
        
        const pendingDeposit = await contract.getPendingDeposit(userAddress);
        console.log("Pending deposit:", {
            token: pendingDeposit.token.toString(),
            amount: pendingDeposit.amount.toString(),
            contractBalanceBefore: pendingDeposit.contractBalanceBefore.toString(),
            timestamp: new Date(Number(pendingDeposit.timestamp) * 1000).toISOString(),
            completed: pendingDeposit.completed
        });
        
        // If there's no valid pending deposit, create one for testing
        if (pendingDeposit.timestamp.toString() === "0") {
            console.log("\n=== Creating New Test Deposit ===");
            
            // Use the amount that matches what's in the contract (0.01 ETH)
            const testAmount = contractBalance; // Use the current balance as the expected amount
            console.log("Test amount:", ethers.formatEther(testAmount), "ETH");
            
            const [signer] = await ethers.getSigners();
            const contractWithSigner = contract.connect(signer);
            
            // Prepare a new deposit
            console.log("Preparing deposit...");
            const tx = await contractWithSigner.prepareDeposit(0, testAmount);
            console.log("Transaction hash:", tx.hash);
            await tx.wait();
            console.log("✅ Deposit prepared successfully");
            
            // Check the new pending deposit
            const newPendingDeposit = await contract.getPendingDeposit(signer.address);
            console.log("New pending deposit:", {
                token: newPendingDeposit.token.toString(),
                amount: newPendingDeposit.amount.toString(),
                contractBalanceBefore: newPendingDeposit.contractBalanceBefore.toString(),
                timestamp: new Date(Number(newPendingDeposit.timestamp) * 1000).toISOString(),
                completed: newPendingDeposit.completed
            });
            
            // Check if it can be completed
            const canComplete = await contract.canCompleteDeposit(signer.address);
            console.log("Can complete deposit:", canComplete);
            
            console.log("\n=== Instructions ===");
            console.log("1. The deposit has been prepared for address:", signer.address);
            console.log("2. Update the frontend to use this address or prepare a new deposit");
            console.log("3. The contract already has the required ETH balance");
            console.log("4. You can now complete the deposit with ZK proof");
            
        } else {
            console.log("\n=== Existing Deposit Found ===");
            const canComplete = await contract.canCompleteDeposit(userAddress);
            console.log("Can complete deposit:", canComplete);
            
            if (!canComplete) {
                console.log("❌ Deposit cannot be completed. Possible reasons:");
                console.log("- Amount mismatch between expected and actual balance increase");
                console.log("- Deposit already completed");
                console.log("- Contract balance changed since preparation");
                
                const expectedAmount = BigInt(pendingDeposit.amount);
                const balanceBefore = BigInt(pendingDeposit.contractBalanceBefore);
                const actualIncrease = contractBalance - balanceBefore;
                const tolerance = expectedAmount / BigInt(100);
                
                console.log("\nBalance analysis:");
                console.log("Expected amount:", expectedAmount.toString());
                console.log("Balance before:", balanceBefore.toString());
                console.log("Actual increase:", actualIncrease.toString());
                console.log("Tolerance (1%):", tolerance.toString());
                console.log("Should be valid:", actualIncrease >= (expectedAmount - tolerance));
            } else {
                console.log("✅ Deposit can be completed!");
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