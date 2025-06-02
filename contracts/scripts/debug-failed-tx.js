const { ethers } = require("hardhat");

async function main() {
    const txHash = "0xb890f35654616c4bf0cf5bf5c222481b5ff102032e018e721ce51ffe2b9bbfc8";
    
    try {
        const tx = await ethers.provider.getTransaction(txHash);
        const receipt = await ethers.provider.getTransactionReceipt(txHash);
        
        console.log("=== Transaction Analysis ===");
        console.log("Hash:", tx.hash);
        console.log("Status:", receipt.status);
        console.log("Gas used:", receipt.gasUsed.toString());
        console.log("Gas limit:", tx.gasLimit.toString());
        console.log("From:", tx.from);
        console.log("To:", tx.to);
        console.log("Data length:", tx.data.length);
        console.log("Logs count:", receipt.logs.length);
        
        // Analyze the failure - status 0 means revert
        if (receipt.status === 0) {
            console.log("\n❌ Transaction REVERTED");
            
            // Try to simulate the transaction to get revert reason
            try {
                await ethers.provider.call({
                    to: tx.to,
                    data: tx.data,
                    from: tx.from
                }, tx.blockNumber - 1);
                console.log("Simulation succeeded - revert might be block-specific");
            } catch (simErr) {
                console.log("Simulation failed:", simErr.message);
                
                // Try to extract revert reason
                if (simErr.data) {
                    try {
                        const reason = ethers.toUtf8String("0x" + simErr.data.slice(10));
                        console.log("Revert reason:", reason);
                    } catch (decodeErr) {
                        console.log("Could not decode revert reason");
                    }
                }
            }
        }
        
        // Check if the transaction data looks correct
        if (tx.data.startsWith("0xdac90aeb")) {
            console.log("\n✅ Transaction calls withdraw function");
            
            // Try basic decoding
            const contractABI = [
                "function withdraw(bytes32 nullifier, address recipient, uint64 token, uint64 amount, bytes calldata balanceProof, bytes calldata publicValues)"
            ];
            const iface = new ethers.Interface(contractABI);
            
            try {
                const decoded = iface.parseTransaction({ data: tx.data });
                console.log("\nDecoded parameters:");
                console.log("- Nullifier:", decoded.args[0]);
                console.log("- Recipient:", decoded.args[1]);
                console.log("- Token:", decoded.args[2].toString());
                console.log("- Amount:", decoded.args[3].toString());
                console.log("- Proof bytes length:", decoded.args[4].length);
                console.log("- Public values length:", decoded.args[5].length);
                
                // Check basic validation
                console.log("\nBasic validation:");
                console.log("- Amount > 0:", decoded.args[3] > 0);
                console.log("- Token = 150:", decoded.args[2].toString() === "150");
                console.log("- Recipient valid:", decoded.args[1].length === 42);
                console.log("- Proof not empty:", decoded.args[4].length > 2);
                console.log("- Public values not empty:", decoded.args[5].length > 2);
                
            } catch (decodeErr) {
                console.log("Could not decode transaction:", decodeErr.message);
            }
        } else {
            console.log("❌ Transaction does not call withdraw function");
            console.log("Function selector:", tx.data.slice(0, 10));
        }
        
    } catch (error) {
        console.error("Error analyzing transaction:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });