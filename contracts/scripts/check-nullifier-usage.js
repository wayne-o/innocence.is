const { ethers } = require("hardhat");

async function main() {
    const contractAddress = "0x38957E2052AfFff204C4EA8Ae88cDA805C58B7b9";
    const failedTxHash = "0xdde056d08fbbe3ded5116f4940c75df971ea5b5e751e61acd694b70b3c42aeaf";
    
    console.log("=== CHECKING NULLIFIER USAGE ===" );
    
    try {
        const provider = new ethers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');
        
        // Get the failed transaction to extract nullifier
        const tx = await provider.getTransaction(failedTxHash);
        
        // Decode the transaction data manually
        const iface = new ethers.Interface([
            "function withdraw(bytes32 nullifier, address recipient, uint64 token, uint256 amount, bytes calldata balanceProof, bytes calldata publicValues) external",
            "function emergencyWithdrawAll(address recipient, string calldata reason) external"
        ]);
        
        let nullifier;
        try {
            if (!tx || !tx.data) {
                console.log("❌ Transaction data not found");
                return;
            }
            
            console.log("Raw transaction data:", tx.data);
            console.log("Data length:", tx.data.length);
            
            // Extract function selector (first 4 bytes)
            const selector = tx.data.slice(0, 10);
            console.log("Function selector:", selector);
            
            // Calculate expected selectors
            const withdrawSelector = iface.getFunction("withdraw").selector;
            const emergencySelector = iface.getFunction("emergencyWithdrawAll").selector;
            console.log("Expected withdraw selector:", withdrawSelector);
            console.log("Expected emergency selector:", emergencySelector);
            
            if (selector === emergencySelector) {
                console.log("✅ This is an EMERGENCY WITHDRAWAL!");
                const decoded = iface.parseTransaction({ data: tx.data });
                console.log("Emergency withdrawal details:");
                console.log("Recipient:", decoded.args.recipient);
                console.log("Reason:", decoded.args.reason);
                console.log("\n🎯 MYSTERY SOLVED!");
                console.log("This was NOT a private withdrawal that failed.");
                console.log("This was an EMERGENCY WITHDRAWAL that succeeded!");
                console.log("That's why the funds were transferred to your wallet.");
                return;
            } else if (selector !== withdrawSelector) {
                console.log("❌ This is not a withdraw function call!");
                console.log("Function selector:", selector);
                return;
            }
            
            const decoded = iface.parseTransaction({ data: tx.data });
            if (!decoded || !decoded.args) {
                console.log("❌ Decoded transaction has no args");
                return;
            }
            
            nullifier = decoded.args.nullifier;
            console.log("Extracted nullifier:", nullifier);
            console.log("Recipient:", decoded.args.recipient);
            console.log("Token:", decoded.args.token.toString());
            console.log("Amount:", ethers.formatEther(decoded.args.amount), "ETH");
        } catch (error) {
            console.log("❌ Could not decode transaction:", error.message);
            console.log("Error details:", error);
            return;
        }
        
        // Check if nullifier is already used
        const HyperliquidPrivacySystemEVMWithRecovery = await ethers.getContractFactory("HyperliquidPrivacySystemEVMWithRecovery");
        const contract = HyperliquidPrivacySystemEVMWithRecovery.attach(contractAddress);
        
        console.log("\n=== Nullifier Status ===");
        const nullifierUsed = await contract.nullifiers(nullifier);
        console.log("Nullifier already used:", nullifierUsed);
        
        if (nullifierUsed) {
            console.log("\n🔴 PROBLEM IDENTIFIED!");
            console.log("This nullifier was already used in a previous withdrawal.");
            console.log("This is why your withdrawal failed - double-spend protection.");
            
            // Look for the original withdrawal that used this nullifier
            console.log("\n=== Finding Original Withdrawal ===");
            const currentBlock = await provider.getBlockNumber();
            const fromBlock = Math.max(0, currentBlock - 10000); // Search last 10k blocks
            
            console.log(`Searching blocks ${fromBlock} to ${currentBlock} for PrivateWithdraw events...`);
            
            try {
                const filter = contract.filters.PrivateWithdraw(nullifier);
                const events = await contract.queryFilter(filter, fromBlock, currentBlock);
                
                if (events.length > 0) {
                    console.log(`Found ${events.length} withdrawal(s) with this nullifier:`);
                    for (const event of events) {
                        console.log("\n--- Original Withdrawal ---");
                        console.log("Block:", event.blockNumber);
                        console.log("Transaction:", event.transactionHash);
                        console.log("Nullifier:", event.args.nullifier);
                        console.log("Timestamp:", new Date(Number(event.args.timestamp) * 1000).toISOString());
                        
                        // Get transaction details
                        const originalTx = await provider.getTransaction(event.transactionHash);
                        console.log("Original sender:", originalTx.from);
                        console.log("Gas used in original:", originalTx.gasLimit.toString());
                    }
                } else {
                    console.log("No PrivateWithdraw events found with this nullifier.");
                    console.log("The nullifier may have been marked as used by a different mechanism.");
                }
            } catch (eventError) {
                console.log("Could not search for events:", eventError.message);
            }
        } else {
            console.log("\n✅ Nullifier is NOT used");
            console.log("The withdrawal failure was caused by something else:");
            console.log("1. Invalid ZK proof verification");
            console.log("2. Commitment not found in system");
            console.log("3. Merkle root mismatch");
            console.log("4. Insufficient contract balance");
        }
        
        console.log("\n=== Summary ===");
        if (nullifierUsed) {
            console.log("🔴 CAUSE: Double-spend protection");
            console.log("💡 SOLUTION: Generate a new withdrawal with fresh nullifier");
            console.log("⚠️  WARNING: The commitment may have already been spent");
        } else {
            console.log("🔴 CAUSE: Unknown validation failure");
            console.log("💡 SOLUTION: Check commitment validity and proof generation");
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