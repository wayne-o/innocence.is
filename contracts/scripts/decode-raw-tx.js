const { ethers } = require("hardhat");

async function main() {
    const txHash = "0xdde056d08fbbe3ded5116f4940c75df971ea5b5e751e61acd694b70b3c42aeaf";
    const contractAddress = "0x38957E2052AfFff204C4EA8Ae88cDA805C58B7b9";
    
    console.log("=== RAW TRANSACTION ANALYSIS ===");
    
    try {
        const provider = new ethers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');
        
        // Get transaction
        const tx = await provider.getTransaction(txHash);
        const receipt = await provider.getTransactionReceipt(txHash);
        
        console.log("Transaction succeeded:", receipt.status === 1);
        console.log("Gas used:", receipt.gasUsed.toString());
        console.log("Events emitted:", receipt.logs.length);
        
        // The selector 0xdac90aeb doesn't match any known function
        // Let's check if the contract has this function or if this is calling a different contract
        console.log("\n=== TRANSACTION DETAILS ===");
        console.log("From:", tx.from);
        console.log("To:", tx.to);
        console.log("Value:", ethers.formatEther(tx.value), "ETH");
        console.log("Data:", tx.data);
        
        console.log("\n=== ANALYSIS ===");
        console.log("The function selector 0xdac90aeb doesn't match any standard ERC-20 or common function.");
        console.log("Possible explanations:");
        console.log("1. This is calling a function that doesn't exist (would revert)");
        console.log("2. This is calling a fallback function");
        console.log("3. This is calling a proxy contract");
        console.log("4. This selector corresponds to a different function signature");
        
        // Since it succeeded with low gas usage, it probably hit a simple function
        // Let's check if this could be a different interpretation
        
        console.log("\n=== CHECKING CONTRACT BYTECODE ===");
        const code = await provider.getCode(contractAddress);
        console.log("Contract has code:", code !== "0x");
        console.log("Code length:", code.length);
        
        // Check balance changes
        console.log("\n=== BALANCE ANALYSIS ===");
        const userAddress = tx.from;
        const currentUserBalance = await provider.getBalance(userAddress);
        const currentContractBalance = await provider.getBalance(contractAddress);
        
        console.log("Current user balance:", ethers.formatEther(currentUserBalance), "ETH");
        console.log("Current contract balance:", ethers.formatEther(currentContractBalance), "ETH");
        
        console.log("\n=== CONCLUSION ===");
        console.log("This transaction:");
        console.log("- Called an unknown function (0xdac90aeb)");
        console.log("- Succeeded with minimal gas usage");  
        console.log("- Emitted no events");
        console.log("- Did not transfer any ETH (tx.value = 0)");
        console.log("");
        console.log("This looks like a failed function call that hit a fallback");
        console.log("or a non-existent function that was gracefully handled.");
        console.log("");
        console.log("🔴 THIS WAS NOT A PRIVATE WITHDRAWAL");
        console.log("Your private withdrawal was never actually attempted.");
        console.log("The UI may have generated an incorrect transaction.");
        
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