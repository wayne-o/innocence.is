const { ethers } = require("hardhat");

async function main() {
    const contractAddress = "0x38957E2052AfFff204C4EA8Ae88cDA805C58B7b9";
    
    console.log("=== Creating Fresh Deposit for Frontend Testing ===");
    console.log("Contract:", contractAddress);
    
    try {
        const [deployer] = await ethers.getSigners();
        console.log("User:", deployer.address);
        
        const HyperliquidPrivacySystemEVMWithRecovery = await ethers.getContractFactory("HyperliquidPrivacySystemEVMWithRecovery");
        const contract = HyperliquidPrivacySystemEVMWithRecovery.attach(contractAddress);
        
        // Check current state
        const contractBalance = await ethers.provider.getBalance(contractAddress);
        console.log("Current contract balance:", ethers.formatEther(contractBalance), "ETH");
        
        // Check if there's already a pending deposit
        const currentPending = await contract.getPendingDeposit(deployer.address);
        console.log("Current pending deposit completed:", currentPending.completed);
        
        if (!currentPending.completed && currentPending.timestamp > 0) {
            console.log("✅ You already have a valid pending deposit!");
            const canComplete = await contract.canCompleteDeposit(deployer.address);
            console.log("Can complete:", canComplete);
            
            if (canComplete) {
                console.log("🎉 Ready for frontend completion!");
                return;
            }
        }
        
        console.log("\n=== Creating New Fresh Deposit ===");
        
        // Create a deposit for a reasonable amount
        const depositAmount = ethers.parseEther("0.1"); // Use the amount that's in the contract
        console.log("Deposit amount:", ethers.formatEther(depositAmount), "ETH");
        
        // Record balance before
        const balanceBefore = contractBalance;
        console.log("Balance before:", ethers.formatEther(balanceBefore), "ETH");
        
        // Step 1: Prepare deposit
        console.log("1. Preparing deposit...");
        const prepareTx = await contract.prepareDeposit(0, depositAmount);
        console.log("Prepare tx:", prepareTx.hash);
        await prepareTx.wait();
        
        // Since the contract already has ETH, this deposit should be immediately completable
        const newPending = await contract.getPendingDeposit(deployer.address);
        const canComplete = await contract.canCompleteDeposit(deployer.address);
        
        console.log("\n=== Deposit Status ===");
        console.log("Pending amount:", ethers.formatEther(newPending.amount), "ETH");
        console.log("Contract balance before:", ethers.formatEther(newPending.contractBalanceBefore), "ETH");
        console.log("Current contract balance:", ethers.formatEther(contractBalance), "ETH");
        console.log("Can complete:", canComplete);
        
        if (canComplete) {
            console.log("\n🎉 SUCCESS! Fresh deposit ready for frontend!");
            console.log("✅ Address:", deployer.address);
            console.log("✅ Amount:", ethers.formatEther(depositAmount), "ETH");
            console.log("✅ Contract has sufficient balance to complete");
            console.log("\n📱 Frontend should now work with this pending deposit");
        } else {
            console.log("\n⚠️  Deposit prepared but not ready for completion");
            console.log("You may need to send additional ETH to the contract");
            
            // Calculate how much more is needed
            const expectedAmount = BigInt(newPending.amount);
            const actualIncrease = contractBalance - BigInt(newPending.contractBalanceBefore);
            const needed = expectedAmount - actualIncrease;
            
            if (needed > 0) {
                console.log("Additional ETH needed:", ethers.formatEther(needed), "ETH");
                
                console.log("\n=== Sending Additional ETH ===");
                const sendTx = await deployer.sendTransaction({
                    to: contractAddress,
                    value: needed,
                    gasLimit: 50000
                });
                console.log("Send ETH tx:", sendTx.hash);
                await sendTx.wait();
                
                const finalCanComplete = await contract.canCompleteDeposit(deployer.address);
                console.log("Can complete after sending ETH:", finalCanComplete);
                
                if (finalCanComplete) {
                    console.log("🎉 NOW READY FOR FRONTEND COMPLETION!");
                }
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