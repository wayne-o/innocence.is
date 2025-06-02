const { ethers } = require("hardhat");

async function main() {
    const contractAddress = "0x60564ff628987871EFFF0A2Ec8b6EF722895152e";
    const userAddress = "0xA8b90cEf0e388a23Cf2d3625481ce14D7c53750D"; // The user from the logs
    
    console.log("=== Preparing Deposit for User ===");
    console.log("Contract:", contractAddress);
    console.log("User:", userAddress);
    
    try {
        const HyperliquidPrivacySystemEVM = await ethers.getContractFactory("HyperliquidPrivacySystemEVM");
        const contract = HyperliquidPrivacySystemEVM.attach(contractAddress);
        
        // First, check if user already has a pending deposit
        console.log("\n=== Checking Current State ===");
        const currentPending = await contract.getPendingDeposit(userAddress);
        console.log("Current pending deposit:", {
            token: currentPending.token.toString(),
            amount: currentPending.amount.toString(),
            contractBalanceBefore: currentPending.contractBalanceBefore.toString(),
            timestamp: new Date(Number(currentPending.timestamp) * 1000).toISOString(),
            completed: currentPending.completed
        });
        
        const contractBalance = await ethers.provider.getBalance(contractAddress);
        console.log("Current contract balance:", ethers.formatEther(contractBalance), "ETH");
        
        // Get a signer (this will be the deployer, but we'll prepare for any user)
        const [signer] = await ethers.getSigners();
        console.log("Signer:", signer.address);
        
        // If user doesn't have a pending deposit, create one for them
        if (currentPending.timestamp.toString() === "0") {
            console.log("\n=== Creating Deposit for User ===");
            
            // We'll create a deposit for 0.001 ETH (small test amount)
            const depositAmount = ethers.parseEther("0.001");
            console.log("Deposit amount:", ethers.formatEther(depositAmount), "ETH");
            
            const contractWithSigner = contract.connect(signer);
            
            console.log("Preparing deposit...");
            const tx = await contractWithSigner.prepareDeposit(0, depositAmount);
            console.log("Transaction hash:", tx.hash);
            await tx.wait();
            console.log("✅ Deposit prepared for signer:", signer.address);
            
            // Check the new pending deposit
            const newPending = await contract.getPendingDeposit(signer.address);
            console.log("New pending deposit:", {
                token: newPending.token.toString(),
                amount: ethers.formatEther(newPending.amount),
                contractBalanceBefore: ethers.formatEther(newPending.contractBalanceBefore),
                timestamp: new Date(Number(newPending.timestamp) * 1000).toISOString(),
                completed: newPending.completed
            });
            
            // Now send the required ETH to complete the deposit
            console.log("\n=== Sending ETH to Contract ===");
            const sendTx = await signer.sendTransaction({
                to: contractAddress,
                value: depositAmount,
                gasLimit: 50000
            });
            console.log("Send ETH transaction:", sendTx.hash);
            await sendTx.wait();
            console.log("✅ ETH sent to contract");
            
            // Check if deposit can be completed
            const canComplete = await contract.canCompleteDeposit(signer.address);
            console.log("\n=== Final Status ===");
            console.log("Can complete deposit:", canComplete);
            
            const finalBalance = await ethers.provider.getBalance(contractAddress);
            console.log("Final contract balance:", ethers.formatEther(finalBalance), "ETH");
            
            if (canComplete) {
                console.log("\n=== Success! ===");
                console.log("✅ Deposit ready for completion");
                console.log("📍 User address:", signer.address);
                console.log("💰 Amount:", ethers.formatEther(depositAmount), "ETH");
                console.log("🔧 Update frontend to use this address or connect with this wallet");
            } else {
                console.log("❌ Deposit still not ready - there may be a contract issue");
            }
            
        } else {
            console.log("✅ User already has a pending deposit");
            const canComplete = await contract.canCompleteDeposit(userAddress);
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