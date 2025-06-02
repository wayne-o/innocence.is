const { ethers } = require("hardhat");

async function main() {
    const txHash = "0xdde056d08fbbe3ded5116f4940c75df971ea5b5e751e61acd694b70b3c42aeaf";
    
    console.log("=== CHECKING WITHDRAWAL TRANSACTION ===");
    console.log("TX Hash:", txHash);
    
    try {
        const provider = new ethers.JsonRpcProvider(
            process.env.RPC_URL || 'https://rpc.hyperliquid.xyz/evm'
        );
        
        // Get transaction details
        console.log("\n=== Transaction Details ===");
        const tx = await provider.getTransaction(txHash);
        
        if (!tx) {
            console.log("❌ Transaction not found!");
            console.log("This could mean:");
            console.log("1. Transaction hash is incorrect");
            console.log("2. Transaction hasn't been mined yet");
            console.log("3. RPC network issue");
            return;
        }
        
        console.log("From:", tx.from);
        console.log("To:", tx.to);
        console.log("Value:", ethers.formatEther(tx.value), "ETH");
        console.log("Gas Limit:", tx.gasLimit.toString());
        console.log("Gas Price:", ethers.formatUnits(tx.gasPrice, "gwei"), "gwei");
        console.log("Block Number:", tx.blockNumber);
        console.log("Status:", tx.blockNumber ? "Mined" : "Pending");
        
        // Get transaction receipt
        console.log("\n=== Transaction Receipt ===");
        const receipt = await provider.getTransactionReceipt(txHash);
        
        if (!receipt) {
            console.log("❌ No receipt found - transaction may still be pending");
            return;
        }
        
        console.log("Status:", receipt.status === 1 ? "✅ SUCCESS" : "❌ FAILED");
        console.log("Block Number:", receipt.blockNumber);
        console.log("Gas Used:", receipt.gasUsed.toString());
        console.log("Effective Gas Price:", ethers.formatUnits(receipt.gasPrice, "gwei"), "gwei");
        
        if (receipt.status === 0) {
            console.log("❌ TRANSACTION FAILED!");
            console.log("The transaction was mined but reverted");
            return;
        }
        
        // Check if this was a contract interaction
        if (tx.data && tx.data !== "0x") {
            console.log("\n=== Contract Interaction ===");
            console.log("Data:", tx.data.slice(0, 10) + "...");
            
            // Try to decode the function call
            try {
                const contractInterface = new ethers.Interface([
                    "function withdraw(bytes32 nullifier, address recipient, uint64 token, uint256 amount, bytes calldata balanceProof, bytes calldata publicValues) external",
                    "function emergencyWithdrawAll(address recipient, string calldata reason) external"
                ]);
                
                const decoded = contractInterface.parseTransaction({ data: tx.data });
                console.log("Function called:", decoded.name);
                console.log("Parameters:", decoded.args);
                
                if (decoded.name === "withdraw") {
                    console.log("\n=== Withdrawal Details ===");
                    console.log("Recipient:", decoded.args.recipient);
                    console.log("Token:", decoded.args.token.toString());
                    console.log("Amount:", ethers.formatEther(decoded.args.amount), "ETH");
                } else if (decoded.name === "emergencyWithdrawAll") {
                    console.log("\n=== Emergency Withdrawal ===");
                    console.log("Recipient:", decoded.args.recipient);
                    console.log("Reason:", decoded.args.reason);
                }
                
            } catch (decodeError) {
                console.log("Could not decode function call");
            }
        }
        
        // Check logs/events
        console.log("\n=== Events/Logs ===");
        if (receipt.logs.length > 0) {
            console.log("Number of events:", receipt.logs.length);
            for (let i = 0; i < receipt.logs.length; i++) {
                const log = receipt.logs[i];
                console.log(`Event ${i + 1}:`);
                console.log("  Address:", log.address);
                console.log("  Topics:", log.topics);
                console.log("  Data:", log.data.slice(0, 20) + "...");
            }
        } else {
            console.log("No events emitted");
        }
        
        // Check balance changes
        console.log("\n=== Balance Check ===");
        const contractAddress = "0x38957E2052AfFff204C4EA8Ae88cDA805C58B7b9";
        const userAddress = tx.from;
        
        const contractBalance = await provider.getBalance(contractAddress);
        const userBalance = await provider.getBalance(userAddress);
        
        console.log("Contract balance:", ethers.formatEther(contractBalance), "ETH");
        console.log("User balance:", ethers.formatEther(userBalance), "ETH");
        
        console.log("\n=== Analysis ===");
        if (receipt.status === 1) {
            if (tx.value > 0) {
                console.log("✅ This was a direct ETH transfer of", ethers.formatEther(tx.value), "ETH");
                console.log("✅ ETH should be in recipient wallet:", tx.to);
            } else if (tx.data && tx.data !== "0x") {
                console.log("✅ This was a contract function call");
                console.log("✅ Check the recipient address specified in the function parameters");
            }
            console.log("✅ Transaction succeeded - funds should have moved");
        }
        
    } catch (error) {
        console.error("Error checking transaction:", error.message);
        console.log("\n🔄 Retrying with different RPC...");
        
        try {
            // Try with mainnet RPC
            const mainnetProvider = new ethers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');
            const tx = await mainnetProvider.getTransaction(txHash);
            
            if (tx) {
                console.log("✅ Found transaction on mainnet");
                console.log("From:", tx.from);
                console.log("To:", tx.to);
                console.log("Value:", ethers.formatEther(tx.value), "ETH");
            } else {
                console.log("❌ Transaction not found on any network");
            }
        } catch (retryError) {
            console.log("❌ Retry also failed:", retryError.message);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });