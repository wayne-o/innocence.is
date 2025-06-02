const { ethers } = require("hardhat");

async function main() {
    const txHash = "0x59acba84da4256ece2a593cc2aa8433ce1ffd5adebc0572ac1073792d192ac74";
    const contractAddress = "0x60564ff628987871EFFF0A2Ec8b6EF722895152e";
    
    console.log("=== CHECKING RECOVERY TRANSACTION ===");
    console.log("TX Hash:", txHash);
    console.log("Contract:", contractAddress);
    
    try {
        const provider = new ethers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');
        
        const tx = await provider.getTransaction(txHash);
        const receipt = await provider.getTransactionReceipt(txHash);
        
        console.log("\n=== Transaction Details ===");
        console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
        console.log("Gas used:", receipt.gasUsed.toString());
        console.log("Events emitted:", receipt.logs.length);
        
        // Check current balance
        const balance = await provider.getBalance(contractAddress);
        console.log("Current contract balance:", ethers.formatEther(balance), "ETH");
        
        // The Pure EVM contract might not have emergencyWithdrawAll function
        // Let's check what functions it has
        console.log("\n=== Contract Code Check ===");
        const code = await provider.getCode(contractAddress);
        console.log("Contract has code:", code !== "0x");
        console.log("Code length:", code.length);
        
        if (receipt.status === 0) {
            console.log("❌ Transaction failed - the Pure EVM contract might not have emergencyWithdrawAll function");
            console.log("💡 This contract might need private withdrawal using commitment data instead");
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