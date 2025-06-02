const { ethers } = require("hardhat");

async function main() {
    const failedTxHash = "0xdde056d08fbbe3ded5116f4940c75df971ea5b5e751e61acd694b70b3c42aeaf";
    const contractAddress = "0x38957E2052AfFff204C4EA8Ae88cDA805C58B7b9";
    
    console.log("=== DEBUGGING FAILED WITHDRAWAL ===");
    console.log("TX Hash:", failedTxHash);
    console.log("Contract:", contractAddress);
    
    try {
        const provider = new ethers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');
        const HyperliquidPrivacySystemEVMWithRecovery = await ethers.getContractFactory("HyperliquidPrivacySystemEVMWithRecovery");
        const contract = HyperliquidPrivacySystemEVMWithRecovery.attach(contractAddress);
        
        // Get the failed transaction
        const tx = await provider.getTransaction(failedTxHash);
        const receipt = await provider.getTransactionReceipt(failedTxHash);
        
        console.log("\n=== Transaction Analysis ===");
        console.log("Status:", receipt.status === 1 ? "SUCCESS (but no funds transferred)" : "FAILED");
        console.log("Gas Used:", receipt.gasUsed.toString());
        console.log("Gas Limit:", tx.gasLimit.toString());
        
        // Decode the function call
        console.log("\n=== Function Call Analysis ===");
        try {
            const iface = new ethers.Interface([
                "function withdraw(bytes32 nullifier, address recipient, uint64 token, uint256 amount, bytes calldata balanceProof, bytes calldata publicValues) external"
            ]);
            
            const decoded = iface.parseTransaction({ data: tx.data });
            console.log("Function:", decoded.name);
            console.log("Nullifier:", decoded.args.nullifier);
            console.log("Recipient:", decoded.args.recipient);
            console.log("Token:", decoded.args.token.toString());
            console.log("Amount:", ethers.formatEther(decoded.args.amount), "ETH");
            console.log("Proof length:", decoded.args.balanceProof.length);
            console.log("Public values length:", decoded.args.publicValues.length);
            
            // Check if nullifier was already used
            console.log("\n=== Nullifier Check ===");
            const nullifierUsed = await contract.nullifiers(decoded.args.nullifier);
            console.log("Nullifier already used:", nullifierUsed);
            
            if (nullifierUsed) {
                console.log("🔴 PROBLEM: Nullifier was already used!");
                console.log("This means either:");
                console.log("1. You tried to withdraw the same commitment twice");
                console.log("2. There was a nullifier collision (very unlikely)");
                console.log("3. The frontend generated a duplicate nullifier");
            }
            
            // Check commitment exists
            console.log("\n=== Commitment Check ===");
            try {
                // Decode public values to get the commitment
                const balanceProofData = ethers.AbiCoder.defaultAbiCoder().decode(
                    ["bytes32", "bytes32", "uint256", "uint64"],
                    decoded.args.publicValues
                );
                
                const commitment = balanceProofData[0];
                const merkleRoot = balanceProofData[1];
                const minBalance = balanceProofData[2];
                const assetId = balanceProofData[3];
                
                console.log("Commitment:", commitment);
                console.log("Merkle root:", merkleRoot);
                console.log("Min balance:", ethers.formatEther(minBalance), "ETH");
                console.log("Asset ID:", assetId.toString());
                
                const commitmentUsed = await contract.commitments(commitment);
                console.log("Commitment exists:", commitmentUsed);
                
                if (!commitmentUsed) {
                    console.log("🔴 PROBLEM: Commitment doesn't exist in the system!");
                    console.log("This means:");
                    console.log("1. The deposit was never completed");
                    console.log("2. Wrong commitment was used");
                    console.log("3. Commitment was from a different contract");
                }
                
                // Check merkle root
                const currentMerkleRoot = await contract.getMerkleRoot();
                console.log("Current merkle root:", currentMerkleRoot);
                console.log("Proof merkle root:", merkleRoot);
                console.log("Merkle roots match:", currentMerkleRoot === merkleRoot);
                
                if (currentMerkleRoot !== merkleRoot) {
                    console.log("🔴 PROBLEM: Merkle root mismatch!");
                    console.log("This means:");
                    console.log("1. The proof was generated against an old state");
                    console.log("2. New commitments were added after proof generation");
                    console.log("3. Wrong merkle root in the proof");
                }
                
            } catch (decodeError) {
                console.log("❌ Could not decode public values:", decodeError.message);
            }
            
            // Check token support
            console.log("\n=== Token Support Check ===");
            const tokenAddress = await contract.tokenAddresses(decoded.args.token);
            console.log("Token address for ID", decoded.args.token.toString() + ":", tokenAddress);
            
            if (decoded.args.token === BigInt(0)) {
                console.log("Token 0 = Native ETH");
            } else if (tokenAddress === ethers.ZeroAddress) {
                console.log("🔴 PROBLEM: Token not supported!");
            }
            
            // Check contract balance at time of withdrawal
            console.log("\n=== Balance Check ===");
            const block = await provider.getBlock(receipt.blockNumber);
            console.log("Withdrawal block:", receipt.blockNumber);
            console.log("Block timestamp:", new Date(block.timestamp * 1000).toISOString());
            
            // We can't get historical balance easily, but we can check current
            const currentBalance = await provider.getBalance(contractAddress);
            console.log("Current contract balance:", ethers.formatEther(currentBalance), "ETH");
            
        } catch (decodeError) {
            console.log("❌ Could not decode transaction:", decodeError.message);
        }
        
        // Check for any events that were emitted
        console.log("\n=== Events Analysis ===");
        if (receipt.logs.length === 0) {
            console.log("🔴 CRITICAL: NO EVENTS WERE EMITTED!");
            console.log("This means the withdrawal function exited early");
            console.log("Most likely causes:");
            console.log("1. require() statement failed silently");
            console.log("2. ZK proof verification failed");
            console.log("3. Transfer failed silently");
        } else {
            console.log("Events found:", receipt.logs.length);
            for (const log of receipt.logs) {
                console.log("Event address:", log.address);
                console.log("Event topics:", log.topics);
            }
        }
        
        console.log("\n=== ROOT CAUSE ANALYSIS ===");
        console.log("The withdrawal transaction succeeded (didn't revert) but:");
        console.log("1. No PrivateWithdraw event was emitted");
        console.log("2. No ETH was transferred to the recipient");
        console.log("3. This indicates the function exited early due to a failed check");
        
        console.log("\nMost likely causes in order of probability:");
        console.log("1. 🔴 Nullifier already used (double-spend protection)");
        console.log("2. 🔴 Invalid ZK proof (SP1 verification failed)");
        console.log("3. 🔴 Commitment not found (wrong commitment used)");
        console.log("4. 🔴 Merkle root mismatch (stale proof)");
        console.log("5. 🔴 Insufficient contract balance");
        
    } catch (error) {
        console.error("Debug error:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });