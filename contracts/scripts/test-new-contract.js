const { ethers } = require("hardhat");

async function main() {
    const newContractAddress = "0x38957E2052AfFff204C4EA8Ae88cDA805C58B7b9";
    
    console.log("=== Testing New Recovery Contract ===");
    console.log("Contract:", newContractAddress);
    
    try {
        const [deployer] = await ethers.getSigners();
        console.log("User:", deployer.address);
        
        const HyperliquidPrivacySystemEVMWithRecovery = await ethers.getContractFactory("HyperliquidPrivacySystemEVMWithRecovery");
        const contract = HyperliquidPrivacySystemEVMWithRecovery.attach(newContractAddress);
        
        // Check contract state
        const contractBalance = await ethers.provider.getBalance(newContractAddress);
        const complianceAuthority = await contract.complianceAuthority();
        
        console.log("Contract ETH balance:", ethers.formatEther(contractBalance), "ETH");
        console.log("Compliance authority:", complianceAuthority);
        console.log("Are you authorized?", deployer.address.toLowerCase() === complianceAuthority.toLowerCase());
        
        // Check pending deposits
        const pendingDeposit = await contract.getPendingDeposit(deployer.address);
        console.log("Pending deposit:", {
            token: pendingDeposit.token.toString(),
            amount: ethers.formatEther(pendingDeposit.amount),
            contractBalanceBefore: ethers.formatEther(pendingDeposit.contractBalanceBefore),
            timestamp: new Date(Number(pendingDeposit.timestamp) * 1000).toISOString(),
            completed: pendingDeposit.completed
        });
        
        const canComplete = await contract.canCompleteDeposit(deployer.address);
        console.log("Can complete deposit:", canComplete);
        
        console.log("\n=== Testing Deposit Flow ===");
        
        // Test a small deposit to make sure everything works
        const testAmount = ethers.parseEther("0.001"); // Small test amount
        console.log("Test deposit amount:", ethers.formatEther(testAmount), "ETH");
        
        // Step 1: Prepare deposit
        console.log("1. Preparing deposit...");
        const prepareTx = await contract.prepareDeposit(0, testAmount);
        console.log("Prepare tx:", prepareTx.hash);
        await prepareTx.wait();
        
        // Step 2: Send ETH
        console.log("2. Sending ETH to contract...");
        const sendTx = await deployer.sendTransaction({
            to: newContractAddress,
            value: testAmount,
            gasLimit: 50000
        });
        console.log("Send ETH tx:", sendTx.hash);
        await sendTx.wait();
        
        // Step 3: Check if ready for completion
        const newCanComplete = await contract.canCompleteDeposit(deployer.address);
        const newPending = await contract.getPendingDeposit(deployer.address);
        const newBalance = await ethers.provider.getBalance(newContractAddress);
        
        console.log("\n=== After Deposit Preparation ===");
        console.log("Contract balance:", ethers.formatEther(newBalance), "ETH");
        console.log("Can complete deposit:", newCanComplete);
        console.log("Pending amount:", ethers.formatEther(newPending.amount), "ETH");
        
        if (newCanComplete) {
            console.log("✅ NEW CONTRACT READY FOR FRONTEND TESTING!");
            console.log("🎯 Frontend should now work with the new contract address");
            console.log("📍 Contract:", newContractAddress);
            console.log("💰 Test deposit ready for completion");
        } else {
            console.log("❌ Something is not working correctly");
        }
        
        console.log("\n=== Emergency Functions Available ===");
        console.log("- emergencyWithdraw(address, uint64, uint256, string)");
        console.log("- emergencyWithdrawAll(address, string)");
        console.log("Both functions can only be called by:", complianceAuthority);
        
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