const { ethers } = require("hardhat");

async function main() {
    const contractAddress = "0x60564ff628987871EFFF0A2Ec8b6EF722895152e";
    const targetUser = "0xA8b90cEf0e388a23Cf2d3625481ce14D7c53750D"; // The user from frontend logs
    
    console.log("=== Creating Deposit for Specific User ===");
    console.log("Contract:", contractAddress);
    console.log("Target user:", targetUser);
    
    try {
        const HyperliquidPrivacySystemEVM = await ethers.getContractFactory("HyperliquidPrivacySystemEVM");
        const contract = HyperliquidPrivacySystemEVM.attach(contractAddress);
        
        console.log("\n=== Current State ===");
        const contractBalance = await ethers.provider.getBalance(contractAddress);
        console.log("Contract balance:", ethers.formatEther(contractBalance), "ETH");
        
        // Check current pending deposit for target user
        const currentPending = await contract.getPendingDeposit(targetUser);
        console.log("Target user pending deposit:", {
            amount: currentPending.amount.toString(),
            timestamp: new Date(Number(currentPending.timestamp) * 1000).toISOString()
        });
        
        // We need to use an admin/deployer account to set up the state
        // In a real app, the user would call prepareDeposit themselves
        const [deployer] = await ethers.getSigners();
        console.log("Using deployer:", deployer.address);
        
        // Since we can't directly create a deposit for another user (the function uses msg.sender),
        // we need to simulate what would happen if the user called prepareDeposit
        
        console.log("\n=== Solution Approach ===");
        console.log("The issue is that prepareDeposit() uses msg.sender, so we can't create");
        console.log("a pending deposit for a different address from the contract level.");
        console.log("");
        console.log("The user needs to:");
        console.log("1. Connect with their wallet (0xA8b90cEf0e388a23Cf2d3625481ce14D7c53750D)");
        console.log("2. Call prepareDeposit() from the frontend");
        console.log("3. Send ETH to the contract");
        console.log("4. Complete the deposit with ZK proof");
        console.log("");
        console.log("OR");
        console.log("");
        console.log("Use the already prepared deposit for:", deployer.address);
        
        // Check if deployer has a working deposit
        const deployerPending = await contract.getPendingDeposit(deployer.address);
        const canComplete = await contract.canCompleteDeposit(deployer.address);
        
        console.log("\n=== Available Working Deposit ===");
        console.log("Address:", deployer.address);
        console.log("Amount:", ethers.formatEther(deployerPending.amount), "ETH");
        console.log("Can complete:", canComplete);
        
        if (canComplete) {
            console.log("\n✅ Ready to test deposit completion!");
            console.log("Frontend should:");
            console.log("1. Connect to wallet address:", deployer.address);
            console.log("2. Or manually set userAddress to this value for testing");
            console.log("3. Generate ZK proof and call completeDeposit()");
        }
        
        // Also check how much ETH the target user would need to deposit
        console.log("\n=== For Target User to Create New Deposit ===");
        console.log("1. User calls prepareDeposit(0, amount) - this will succeed");
        console.log("2. User sends ETH to contract - amount should match prepared amount");
        console.log("3. Contract balance increase will be detected");
        console.log("4. User can then complete with ZK proof");
        console.log("");
        console.log("Recommended test amount: 0.001 ETH (1000000000000000 wei)");
        
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