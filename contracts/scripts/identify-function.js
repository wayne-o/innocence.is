const { ethers } = require("hardhat");

async function main() {
    const txData = "0xdac90aeb89d72343303f30b5392f76fa3bae6a9fec9d14d695f02b69bdf42d0e7fba42600000000000000000000000005bd2f329c50860366c0e6d3b4227a422b66ad203000000000000000000000000000000000000000000000000000000000000009600000000000000000000000000000000000000000000000000000000000186a000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000040bad5a9868794c8e11147f3488ff93ec1429a2a6720e2fe33b58fe843de251976bad5a9868794c8e11147f3488ff93ec1429a2a6720e2fe33b58fe843de25197600000000000000000000000000000000000000000000000000000000000000803fee8a192df4433c9197f2c2134c1b3961c961cfa26fc8af5fad4cbf9ddcba89d15bf9e548594cfd56ff7a8acd9d4a107db7f1c24e83fa01931487523daee3cb00000000000000000000000000000000000000000000000000000000000186a00000000000000000000000000000000000000000000000000000000000000096";
    
    const selector = txData.slice(0, 10);
    console.log("Function selector:", selector);
    
    // Try different potential function signatures
    const signatures = [
        "function withdraw(bytes32 nullifier, address recipient, uint64 token, uint256 amount, bytes calldata balanceProof, bytes calldata publicValues)",
        "function withdraw(bytes32, address, uint64, uint256, bytes, bytes)",
        "emergencyWithdrawAll(address,string)",
        "withdraw(bytes32,address,uint64,uint256,bytes,bytes)"
    ];
    
    for (const sig of signatures) {
        try {
            const hash = ethers.keccak256(ethers.toUtf8Bytes(sig));
            const computedSelector = hash.slice(0, 10);
            console.log(`${sig} -> ${computedSelector}`);
            
            if (computedSelector === selector) {
                console.log("✅ MATCH FOUND:", sig);
                
                // Try to decode with this signature
                const iface = new ethers.Interface([`function ${sig} external`]);
                try {
                    const decoded = iface.parseTransaction({ data: txData });
                    console.log("Decoded args:", decoded.args);
                } catch (decodeError) {
                    console.log("Could not decode with this signature:", decodeError.message);
                }
            }
        } catch (error) {
            console.log(`Error with ${sig}:`, error.message);
        }
    }
    
    // Manual calculation for withdraw function
    console.log("\n=== Manual Calculation ===");
    const withdrawSig = "withdraw(bytes32,address,uint64,uint256,bytes,bytes)";
    const hash = ethers.keccak256(ethers.toUtf8Bytes(withdrawSig));
    console.log("withdraw hash:", hash);
    console.log("withdraw selector:", hash.slice(0, 10));
    
    // If it's 0xdac90aeb, let's see what parameters we can extract manually
    console.log("\n=== Manual Parameter Extraction ===");
    const dataWithoutSelector = "0x" + txData.slice(10);
    console.log("Data without selector:", dataWithoutSelector);
    
    // Parameters should be at these offsets
    console.log("Offset 0-32 (nullifier):", "0x" + dataWithoutSelector.slice(2, 66));
    console.log("Offset 32-64 (recipient):", "0x" + dataWithoutSelector.slice(66, 130));
    console.log("Offset 64-96 (token):", "0x" + dataWithoutSelector.slice(130, 194));
    console.log("Offset 96-128 (amount):", "0x" + dataWithoutSelector.slice(194, 258));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });