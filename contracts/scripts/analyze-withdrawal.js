const { ethers } = require("hardhat");

async function main() {
    const txHash = "0x4cf7393e9d28b4e07b81906e0a7a97054cd6a03d0ec55e5106d080b27dc6cef9";
    const contractAddress = "0x38957E2052AfFff204C4EA8Ae88cDA805C58B7b9";
    
    console.log("=== ANALYZING WITHDRAWAL TRANSACTION ===");
    console.log("TX Hash:", txHash);
    
    try {
        const provider = new ethers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');
        
        // Get transaction and receipt
        const tx = await provider.getTransaction(txHash);
        const receipt = await provider.getTransactionReceipt(txHash);
        
        console.log("\n=== Transaction Status ===");
        console.log("Success:", receipt.status === 1);
        console.log("Gas used:", receipt.gasUsed.toString());
        console.log("Events emitted:", receipt.logs.length);
        
        // Check function selector
        console.log("\n=== Function Call ===");
        const selector = tx.data.slice(0, 10);
        console.log("Function selector:", selector);
        console.log("Expected withdraw selector: 0x929f9a38");
        console.log("Correct function called:", selector === "0x929f9a38");
        
        // Decode transaction
        const iface = new ethers.Interface([
            "function withdraw(bytes32 nullifier, address recipient, uint64 token, uint256 amount, bytes calldata balanceProof, bytes calldata publicValues) external",
            "event PrivateWithdraw(bytes32 indexed nullifier, uint256 timestamp)"
        ]);
        
        try {
            const decoded = iface.parseTransaction({ data: tx.data });
            console.log("\n=== Decoded Parameters ===");
            console.log("Nullifier:", decoded.args.nullifier);
            console.log("Recipient:", decoded.args.recipient);
            console.log("Token:", decoded.args.token.toString());
            console.log("Amount:", decoded.args.amount.toString());
            console.log("Amount in ETH:", ethers.formatEther(decoded.args.amount));
        } catch (decodeError) {
            console.log("Could not decode transaction:", decodeError.message);
        }
        
        // Check events
        console.log("\n=== Events Analysis ===");
        if (receipt.logs.length > 0) {
            console.log("Events found:");
            for (let i = 0; i < receipt.logs.length; i++) {
                const log = receipt.logs[i];
                console.log(`Event ${i + 1}:`);
                console.log("  Address:", log.address);
                console.log("  Topics:", log.topics);
                
                try {
                    const parsed = iface.parseLog(log);
                    console.log("  Parsed event:", parsed.name);
                    if (parsed.name === "PrivateWithdraw") {
                        console.log("  ✅ PrivateWithdraw event emitted!");
                        console.log("  Nullifier:", parsed.args.nullifier);
                        console.log("  Timestamp:", new Date(Number(parsed.args.timestamp) * 1000).toISOString());
                    }
                } catch (parseError) {
                    console.log("  Could not parse event");
                }
            }
        } else {
            console.log("❌ NO EVENTS EMITTED");
            console.log("This means the withdrawal function exited early");
        }
        
        // Check balance changes
        console.log("\n=== Balance Check ===");
        const userAddress = tx.from;
        const contractBalance = await provider.getBalance(contractAddress);
        const userBalance = await provider.getBalance(userAddress);
        
        console.log("Current contract balance:", ethers.formatEther(contractBalance), "ETH");
        console.log("Current user balance:", ethers.formatEther(userBalance), "ETH");
        
        // Check if nullifier was marked as used
        console.log("\n=== Nullifier Status ===");
        const HyperliquidPrivacySystemEVMWithRecovery = await ethers.getContractFactory("HyperliquidPrivacySystemEVMWithRecovery");
        const contract = HyperliquidPrivacySystemEVMWithRecovery.attach(contractAddress);
        
        if (tx.data.length > 10) {
            try {
                const decoded = iface.parseTransaction({ data: tx.data });
                const nullifierUsed = await contract.nullifiers(decoded.args.nullifier);
                console.log("Nullifier marked as used:", nullifierUsed);
                
                if (!nullifierUsed && receipt.status === 1) {
                    console.log("🔴 PROBLEM: Transaction succeeded but nullifier not marked as used");
                    console.log("This indicates the withdrawal function did not complete properly");
                }
            } catch (error) {
                console.log("Could not check nullifier status");
            }
        }
        
        console.log("\n=== Conclusion ===");
        if (receipt.status === 1 && receipt.logs.length === 0) {
            console.log("🔴 Transaction succeeded but no events emitted");
            console.log("Most likely causes:");
            console.log("1. Invalid ZK proof verification failed");
            console.log("2. Commitment not found in system");
            console.log("3. Insufficient contract balance for transfer");
            console.log("4. Transfer function failed silently");
        } else if (receipt.logs.length > 0) {
            console.log("✅ Events were emitted - withdrawal may have succeeded");
        }
        
    } catch (error) {
        console.error("Analysis error:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });