const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Checking mock deployment with account:", deployer.address);

    const contractAddress = "0xcbc0a4A93a5FFe0C070Ab02b0Eb4bAB155E7669d";
    
    try {
        // Get contract bytecode to verify it exists
        const code = await ethers.provider.getCode(contractAddress);
        console.log("Contract exists:", code !== "0x");
        
        if (code === "0x") {
            console.log("❌ No contract deployed at this address!");
            return;
        }

        // Try to connect to the contract
        const HyperliquidPrivacySystem = await ethers.getContractFactory("HyperliquidPrivacySystemV5");
        const contract = HyperliquidPrivacySystem.attach(contractAddress);
        
        // Check basic contract state
        console.log("\n=== Contract Status ===");
        
        try {
            const merkleRoot = await contract.getMerkleRoot();
            console.log("Merkle Root:", merkleRoot);
        } catch (err) {
            console.log("Merkle Root call failed:", err.message);
        }
        
        try {
            const depositCount = await contract.depositCount();
            console.log("Deposit Count:", depositCount.toString());
        } catch (err) {
            console.log("Deposit Count call failed:", err.message);
        }
        
        // Check if user has pending deposit
        const userAddress = deployer.address;
        try {
            const canComplete = await contract.canCompleteDeposit(userAddress);
            console.log(`Can complete deposit for ${userAddress}:`, canComplete);
            
            if (canComplete) {
                const pendingDeposit = await contract.pendingDeposits(userAddress);
                console.log("Pending deposit:", {
                    token: pendingDeposit.token.toString(),
                    amount: pendingDeposit.amount.toString(),
                    contractBalanceBefore: pendingDeposit.contractBalanceBefore.toString(),
                    timestamp: new Date(Number(pendingDeposit.timestamp) * 1000).toISOString(),
                    completed: pendingDeposit.completed
                });
            }
        } catch (err) {
            console.log("Pending deposit check failed:", err.message);
        }
        
        console.log("\n✅ Contract is accessible");
        
    } catch (error) {
        console.error("Error checking contract:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });