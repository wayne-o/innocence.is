const { ethers } = require("hardhat");

async function main() {
    const contractAddress = "0x60564ff628987871EFFF0A2Ec8b6EF722895152e";
    const userAddress = "0xA8b90cEf0e388a23Cf2d3625481ce14D7c53750D";
    
    console.log("=== Debugging EVM Deposit ===");
    console.log("Contract:", contractAddress);
    console.log("User:", userAddress);
    
    try {
        const HyperliquidPrivacySystemEVM = await ethers.getContractFactory("HyperliquidPrivacySystemEVM");
        const contract = HyperliquidPrivacySystemEVM.attach(contractAddress);
        
        // Check contract's native ETH balance
        const contractBalance = await ethers.provider.getBalance(contractAddress);
        console.log("Contract ETH balance:", ethers.formatEther(contractBalance), "ETH");
        console.log("Contract ETH balance (wei):", contractBalance.toString());
        
        // Check user's pending deposit
        console.log("\n=== Pending Deposit ===");
        try {
            const pendingDeposit = await contract.getPendingDeposit(userAddress);
            console.log("Pending deposit:", {
                token: pendingDeposit.token.toString(),
                amount: pendingDeposit.amount.toString(),
                contractBalanceBefore: pendingDeposit.contractBalanceBefore.toString(),
                timestamp: new Date(Number(pendingDeposit.timestamp) * 1000).toISOString(),
                completed: pendingDeposit.completed
            });
            
            // Calculate if deposit should be completable
            const expectedAmount = pendingDeposit.amount;
            const balanceBefore = pendingDeposit.contractBalanceBefore;
            const currentBalance = contractBalance;
            const actualIncrease = currentBalance - balanceBefore;
            const tolerance = expectedAmount / 100n; // 1% tolerance
            const minRequired = expectedAmount - tolerance;
            
            console.log("\n=== Balance Analysis ===");
            console.log("Expected amount:", expectedAmount.toString());
            console.log("Balance before:", balanceBefore.toString());
            console.log("Current balance:", currentBalance.toString());
            console.log("Actual increase:", actualIncrease.toString());
            console.log("Min required:", minRequired.toString());
            console.log("Should be completable:", actualIncrease >= minRequired);
            
        } catch (err) {
            console.log("Error getting pending deposit:", err.message);
        }
        
        // Check if deposit can be completed
        console.log("\n=== Contract Check ===");
        try {
            const canComplete = await contract.canCompleteDeposit(userAddress);
            console.log("canCompleteDeposit():", canComplete);
        } catch (err) {
            console.log("Error checking canCompleteDeposit:", err.message);
        }
        
        // Check recent transactions to the contract
        console.log("\n=== Recent Transactions ===");
        const latestBlock = await ethers.provider.getBlockNumber();
        const fromBlock = latestBlock - 100; // Last 100 blocks
        
        const txs = [];
        for (let i = latestBlock; i >= fromBlock; i--) {
            try {
                const block = await ethers.provider.getBlock(i, true);
                if (block && block.transactions) {
                    for (const tx of block.transactions) {
                        if (tx.to && tx.to.toLowerCase() === contractAddress.toLowerCase()) {
                            txs.push({
                                hash: tx.hash,
                                from: tx.from,
                                value: ethers.formatEther(tx.value),
                                block: i
                            });
                        }
                    }
                }
            } catch (blockErr) {
                // Skip blocks that can't be fetched
            }
            
            if (txs.length >= 5) break; // Show last 5 transactions
        }
        
        console.log("Recent transactions to contract:", txs);
        
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