const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
    const userAddress = "0x5Bd2F329C50860366c0E6D3b4227a422B66AD203";
    const privateKey = process.env.PRIVATE_KEY;
    
    const contracts = [
        { name: "Current Recovery System", address: "0x38957E2052AfFff204C4EA8Ae88cDA805C58B7b9" },
        { name: "Pure EVM System", address: "0x60564ff628987871EFFF0A2Ec8b6EF722895152e" }
    ];
    
    console.log("=== RECOVERING ALL FUNDS ===");
    console.log("Recipient:", userAddress);
    
    const provider = new ethers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');
    const signer = new ethers.Wallet(privateKey, provider);
    
    let totalRecovered = 0;
    
    for (const contract of contracts) {
        try {
            console.log(`\n--- ${contract.name} ---`);
            console.log("Address:", contract.address);
            
            // Check balance
            const balance = await provider.getBalance(contract.address);
            const balanceEth = parseFloat(ethers.formatEther(balance));
            console.log("Balance:", balanceEth, "ETH");
            
            if (balanceEth > 0) {
                console.log("🎯 Recovering funds...");
                
                const contractInstance = new ethers.Contract(
                    contract.address,
                    ["function emergencyWithdrawAll(address recipient, string calldata reason) external"],
                    signer
                );
                
                const tx = await contractInstance.emergencyWithdrawAll(
                    userAddress,
                    `Recovery from ${contract.name} - ${new Date().toISOString()}`
                );
                
                console.log("Transaction submitted:", tx.hash);
                
                const receipt = await tx.wait();
                console.log("✅ Recovery confirmed in block:", receipt.blockNumber);
                
                totalRecovered += balanceEth;
                
                // Check final balance
                const finalBalance = await provider.getBalance(contract.address);
                console.log("Final contract balance:", ethers.formatEther(finalBalance), "ETH");
                
            } else {
                console.log("❌ No funds to recover");
            }
            
        } catch (error) {
            console.error(`❌ Error recovering from ${contract.name}:`, error.message);
        }
    }
    
    // Final summary
    console.log("\n=== RECOVERY COMPLETE ===");
    console.log(`💰 Total recovered: ${totalRecovered.toFixed(6)} ETH`);
    
    // Check your final balance
    const finalUserBalance = await provider.getBalance(userAddress);
    console.log("Your final balance:", ethers.formatEther(finalUserBalance), "ETH");
    
    console.log("\n✅ All recoverable funds have been returned to your wallet!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });