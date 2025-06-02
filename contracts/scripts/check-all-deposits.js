const { ethers } = require("hardhat");

async function main() {
    const contractAddress = "0x38957E2052AfFff204C4EA8Ae88cDA805C58B7b9";
    const addresses = [
        "0xA8b90cEf0e388a23Cf2d3625481ce14D7c53750D", // User from logs
        "0x5Bd2F329C50860366c0E6D3b4227a422B66AD203"  // Deployer address
    ];
    
    console.log("=== Checking All Pending Deposits ===");
    console.log("Contract:", contractAddress);
    
    try {
        const HyperliquidPrivacySystemEVM = await ethers.getContractFactory("HyperliquidPrivacySystemEVM");
        const contract = HyperliquidPrivacySystemEVM.attach(contractAddress);
        
        const contractBalance = await ethers.provider.getBalance(contractAddress);
        console.log("Contract ETH balance:", ethers.formatEther(contractBalance), "ETH");
        
        for (const address of addresses) {
            console.log(`\n=== Address: ${address} ===`);
            
            try {
                const pendingDeposit = await contract.getPendingDeposit(address);
                console.log("Pending deposit:", {
                    token: pendingDeposit.token.toString(),
                    amount: ethers.formatEther(pendingDeposit.amount),
                    contractBalanceBefore: ethers.formatEther(pendingDeposit.contractBalanceBefore),
                    timestamp: new Date(Number(pendingDeposit.timestamp) * 1000).toISOString(),
                    completed: pendingDeposit.completed
                });
                
                const canComplete = await contract.canCompleteDeposit(address);
                console.log("Can complete deposit:", canComplete);
                
                if (canComplete) {
                    console.log("🎉 READY FOR COMPLETION! 🎉");
                }
                
                // Calculate if it should be completable
                if (pendingDeposit.timestamp > 0) {
                    const expectedAmount = BigInt(pendingDeposit.amount);
                    const balanceBefore = BigInt(pendingDeposit.contractBalanceBefore);
                    const actualIncrease = contractBalance - balanceBefore;
                    const tolerance = expectedAmount / BigInt(100);
                    const minRequired = expectedAmount - tolerance;
                    
                    console.log("Balance analysis:");
                    console.log("- Expected:", ethers.formatEther(expectedAmount), "ETH");
                    console.log("- Actual increase:", ethers.formatEther(actualIncrease), "ETH");
                    console.log("- Min required:", ethers.formatEther(minRequired), "ETH");
                    console.log("- Should work:", actualIncrease >= minRequired);
                }
                
            } catch (err) {
                console.log("Error checking this address:", err.message);
            }
        }
        
        console.log("\n=== Summary ===");
        console.log("Total contract balance:", ethers.formatEther(contractBalance), "ETH");
        console.log("This represents successful ETH transfers to the contract");
        
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