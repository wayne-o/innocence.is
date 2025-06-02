const { ethers } = require("hardhat");

async function main() {
    const contractAddress = "0x38957E2052AfFff204C4EA8Ae88cDA805C58B7b9";
    const userAddress = "0x5Bd2F329C50860366c0E6D3b4227a422B66AD203";
    
    console.log("=== CURRENT BALANCE CHECK ===");
    console.log("User:", userAddress);
    console.log("Contract:", contractAddress);
    
    try {
        const provider = new ethers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');
        
        // Check current balances
        const userBalance = await provider.getBalance(userAddress);
        const contractBalance = await provider.getBalance(contractAddress);
        
        console.log("\n=== Current Balances ===");
        console.log("Your wallet:", ethers.formatEther(userBalance), "ETH");
        console.log("Contract:", ethers.formatEther(contractBalance), "ETH");
        
        // Let's trace the recent emergency withdrawals to see what happened
        console.log("\n=== Recent Emergency Withdrawals ===");
        
        const HyperliquidPrivacySystemEVMWithRecovery = await ethers.getContractFactory("HyperliquidPrivacySystemEVMWithRecovery");
        const contract = HyperliquidPrivacySystemEVMWithRecovery.attach(contractAddress);
        
        // Check for recent emergency withdrawal events
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = currentBlock - 1000; // Last 1000 blocks
        
        console.log("Searching for EmergencyWithdraw events...");
        
        try {
            const filter = contract.filters.EmergencyWithdraw();
            const events = await contract.queryFilter(filter, fromBlock, currentBlock);
            
            console.log("Found", events.length, "emergency withdrawal events:");
            
            for (const event of events) {
                console.log("\n--- Emergency Withdrawal ---");
                console.log("Block:", event.blockNumber);
                console.log("Transaction:", event.transactionHash);
                console.log("Recipient:", event.args.recipient);
                console.log("Amount:", ethers.formatEther(event.args.amount), "ETH");
                console.log("Reason:", event.args.reason);
                
                // Check if this matches the withdrawal transaction
                if (event.transactionHash === "0xdde056d08fbbe3ded5116f4940c75df971ea5b5e751e61acd694b70b3c42aeaf") {
                    console.log("🎯 This matches your withdrawal transaction!");
                }
            }
            
        } catch (eventError) {
            console.log("Could not fetch events:", eventError.message);
        }
        
        // Also check for PrivateWithdraw events
        console.log("\n=== Private Withdraw Events ===");
        try {
            const withdrawFilter = contract.filters.PrivateWithdraw();
            const withdrawEvents = await contract.queryFilter(withdrawFilter, fromBlock, currentBlock);
            
            console.log("Found", withdrawEvents.length, "private withdrawal events:");
            
            for (const event of withdrawEvents) {
                console.log("\n--- Private Withdrawal ---");
                console.log("Block:", event.blockNumber);
                console.log("Transaction:", event.transactionHash);
                console.log("Nullifier:", event.args.nullifier);
                console.log("Timestamp:", new Date(Number(event.args.timestamp) * 1000).toISOString());
                
                if (event.transactionHash === "0xdde056d08fbbe3ded5116f4940c75df971ea5b5e751e61acd694b70b3c42aeaf") {
                    console.log("🎯 This matches your withdrawal transaction!");
                }
            }
            
        } catch (withdrawEventError) {
            console.log("Could not fetch withdraw events:", withdrawEventError.message);
        }
        
        console.log("\n=== Summary ===");
        console.log("Your current balance:", ethers.formatEther(userBalance), "ETH");
        console.log("Contract still has:", ethers.formatEther(contractBalance), "ETH");
        
        if (contractBalance > 0) {
            console.log("\n⚠️  THERE'S STILL ETH IN THE CONTRACT!");
            console.log("💡 You can recover it with emergency withdrawal");
            console.log("💰 Additional recoverable amount:", ethers.formatEther(contractBalance), "ETH");
        } else {
            console.log("✅ Contract is empty - all funds have been withdrawn");
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