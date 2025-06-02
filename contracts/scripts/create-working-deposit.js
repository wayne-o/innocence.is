const { ethers } = require("hardhat");

async function main() {
    const contractAddress = "0x60564ff628987871EFFF0A2Ec8b6EF722895152e";
    
    console.log("=== Creating Working Deposit ===");
    
    try {
        const [deployer] = await ethers.getSigners();
        console.log("Deployer:", deployer.address);
        
        const HyperliquidPrivacySystemEVM = await ethers.getContractFactory("HyperliquidPrivacySystemEVM");
        const contract = HyperliquidPrivacySystemEVM.attach(contractAddress);
        
        const contractBalance = await ethers.provider.getBalance(contractAddress);
        console.log("Current contract balance:", ethers.formatEther(contractBalance), "ETH");
        
        // Check current pending deposit
        const currentPending = await contract.getPendingDeposit(deployer.address);
        console.log("Current pending deposit completed:", currentPending.completed);
        
        if (currentPending.completed || currentPending.timestamp.toString() === "0") {
            console.log("\n=== Creating Fresh Deposit ===");
            
            // Create a deposit for a reasonable amount that we can complete immediately
            const depositAmount = ethers.parseEther("0.01"); // 0.01 ETH
            console.log("Deposit amount:", ethers.formatEther(depositAmount), "ETH");
            
            // Record balance before deposit
            const balanceBefore = contractBalance;
            
            // Prepare deposit
            console.log("Preparing deposit...");
            const prepareTx = await contract.prepareDeposit(0, depositAmount);
            console.log("Prepare tx:", prepareTx.hash);
            await prepareTx.wait();
            
            // Send the ETH
            console.log("Sending ETH to contract...");
            const sendTx = await deployer.sendTransaction({
                to: contractAddress,
                value: depositAmount,
                gasLimit: 50000
            });
            console.log("Send ETH tx:", sendTx.hash);
            await sendTx.wait();
            
            // Check new state
            const newBalance = await ethers.provider.getBalance(contractAddress);
            const newPending = await contract.getPendingDeposit(deployer.address);
            const canComplete = await contract.canCompleteDeposit(deployer.address);
            
            console.log("\n=== New Deposit State ===");
            console.log("Contract balance:", ethers.formatEther(newBalance), "ETH");
            console.log("Pending amount:", ethers.formatEther(newPending.amount), "ETH");
            console.log("Balance before:", ethers.formatEther(newPending.contractBalanceBefore), "ETH");
            console.log("Can complete:", canComplete);
            
            if (canComplete) {
                console.log("\n✅ SUCCESS! Deposit ready for completion");
                console.log("🎯 Address:", deployer.address);
                console.log("💰 Amount:", ethers.formatEther(depositAmount), "ETH");
                console.log("📱 Frontend should connect with this address");
                console.log("🔐 Generate ZK proof and call completeDeposit()");
            } else {
                console.log("❌ Something went wrong with deposit preparation");
            }
            
        } else {
            console.log("✅ Already have a pending deposit");
            const canComplete = await contract.canCompleteDeposit(deployer.address);
            console.log("Can complete:", canComplete);
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