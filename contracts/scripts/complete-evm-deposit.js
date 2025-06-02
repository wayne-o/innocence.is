const { ethers } = require("hardhat");

async function main() {
    const contractAddress = "0x60564ff628987871EFFF0A2Ec8b6EF722895152e";
    
    console.log("=== Completing EVM Deposit ===");
    console.log("Contract:", contractAddress);
    
    try {
        const [signer] = await ethers.getSigners();
        console.log("Signer:", signer.address);
        
        const HyperliquidPrivacySystemEVM = await ethers.getContractFactory("HyperliquidPrivacySystemEVM");
        const contract = HyperliquidPrivacySystemEVM.attach(contractAddress);
        
        // Check current state
        console.log("\n=== Current State ===");
        const contractBalance = await ethers.provider.getBalance(contractAddress);
        console.log("Contract ETH balance:", ethers.formatEther(contractBalance), "ETH");
        
        const pendingDeposit = await contract.getPendingDeposit(signer.address);
        console.log("Pending deposit:", {
            token: pendingDeposit.token.toString(),
            amount: ethers.formatEther(pendingDeposit.amount), 
            contractBalanceBefore: ethers.formatEther(pendingDeposit.contractBalanceBefore),
            timestamp: new Date(Number(pendingDeposit.timestamp) * 1000).toISOString(),
            completed: pendingDeposit.completed
        });
        
        const expectedAmount = BigInt(pendingDeposit.amount);
        const balanceBefore = BigInt(pendingDeposit.contractBalanceBefore);
        const actualIncrease = contractBalance - balanceBefore;
        
        console.log("\n=== Balance Analysis ===");
        console.log("Expected increase:", ethers.formatEther(expectedAmount), "ETH");
        console.log("Actual increase:", ethers.formatEther(actualIncrease), "ETH");
        
        if (actualIncrease < expectedAmount) {
            const needed = expectedAmount - actualIncrease;
            console.log("Additional ETH needed:", ethers.formatEther(needed), "ETH");
            
            console.log("\n=== Sending Additional ETH ===");
            const tx = await signer.sendTransaction({
                to: contractAddress,
                value: needed,
                gasLimit: 50000
            });
            console.log("Transaction hash:", tx.hash);
            await tx.wait();
            console.log("✅ Additional ETH sent");
            
            // Check new balance
            const newBalance = await ethers.provider.getBalance(contractAddress);
            console.log("New contract balance:", ethers.formatEther(newBalance), "ETH");
            
            const newIncrease = newBalance - balanceBefore;
            console.log("New balance increase:", ethers.formatEther(newIncrease), "ETH");
        } else {
            console.log("✅ Contract has sufficient balance increase");
        }
        
        // Check if deposit can be completed now
        const canComplete = await contract.canCompleteDeposit(signer.address);
        console.log("\n=== Final Check ===");
        console.log("Can complete deposit:", canComplete);
        
        if (canComplete) {
            console.log("✅ Ready to complete deposit with ZK proof!");
            console.log("\n=== Next Steps ===");
            console.log("1. Use the frontend with address:", signer.address);
            console.log("2. Generate compliance proof");
            console.log("3. Call completeDeposit with the proof");
        } else {
            console.log("❌ Still cannot complete deposit");
            // Additional debugging
            const finalBalance = await ethers.provider.getBalance(contractAddress);
            const finalIncrease = finalBalance - balanceBefore;
            const tolerance = expectedAmount / BigInt(100);
            const minRequired = expectedAmount - tolerance;
            
            console.log("Debug info:");
            console.log("Final increase:", finalIncrease.toString());
            console.log("Expected amount:", expectedAmount.toString());
            console.log("Min required:", minRequired.toString());
            console.log("Meets requirement:", finalIncrease >= minRequired);
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