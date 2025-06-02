const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Debugging withdrawal with account:", deployer.address);

    const contractAddress = "0xcbc0a4A93a5FFe0C070Ab02b0Eb4bAB155E7669d";
    
    try {
        const HyperliquidPrivacySystem = await ethers.getContractFactory("HyperliquidPrivacySystemV5");
        const contract = HyperliquidPrivacySystem.attach(contractAddress);
        
        // Check merkle root
        const merkleRoot = await contract.getMerkleRoot();
        console.log("Current Merkle Root:", merkleRoot);
        
        // Check the specific commitment
        const commitment = "0x4e5ee6d33f4321419a609fa2d433a65aed4ec7aa06c97e61135fe418cc879c96";
        console.log("Checking commitment:", commitment);
        
        // Check if commitment exists in the tree
        try {
            const commitmentExists = await contract.commitments(commitment);
            console.log("Commitment exists in contract:", commitmentExists);
        } catch (err) {
            console.log("Error checking commitment:", err.message);
        }
        
        // Check nullifier usage
        const nullifier = "0x9aca594b98443ed9b0490026acb2a859e17f2c78e8a5fa1a891491c63755f1a4";
        console.log("Checking nullifier:", nullifier);
        
        try {
            const nullifierUsed = await contract.nullifiers(nullifier);
            console.log("Nullifier already used:", nullifierUsed);
        } catch (err) {
            console.log("Error checking nullifier:", err.message);
        }
        
        // Check total deposits
        try {
            const totalDeposits = await contract.totalDeposits();
            console.log("Total deposits:", totalDeposits.toString());
        } catch (err) {
            console.log("totalDeposits not available");
        }
        
        // Check contract balance for HYPE (token 150)
        try {
            const contractBalance = await contract.getContractBalance(150);
            console.log("Contract HYPE balance:", contractBalance.toString());
        } catch (err) {
            console.log("Error getting contract balance:", err.message);
        }
        
        console.log("\n=== Withdrawal Parameters Analysis ===");
        console.log("Withdrawal amount: 12000000 (0.12 HYPE)");
        console.log("Recipient:", "0xa8b90cef0e388a23cf2d3625481ce14d7c53750d");
        console.log("Token ID: 150 (HYPE)");
        
        // Try to simulate the withdrawal call to see what fails
        console.log("\n=== Simulating Withdrawal ===");
        try {
            // Use the exact data from the failed transaction
            const mockProofBytes = "0x7df4f31049d764457237e59c0a83e16a1dc9891d78feddfaf950ba2fcf573f327df4f31049d764457237e59c0a83e16a1dc9891d78feddfaf950ba2fcf573f32";
            const mockPublicValues = "0x4e5ee6d33f4321419a609fa2d433a65aed4ec7aa06c97e61135fe418cc879c9674659c612b79d47471778de7976739638c107911fcf9ad28018ae4ba4388bc5a0000000000000000000000000000000000000000000000000000000000b71b000000000000000000000000000000000000000000000000000000000000000096";
            
            console.log("Withdrawal parameters:");
            console.log("  nullifier:", nullifier);
            console.log("  recipient: 0xa8b90cef0e388a23cf2d3625481ce14d7c53750d");
            console.log("  token: 150");
            console.log("  amount: 12000000");
            console.log("  proofBytes length:", mockProofBytes.length);
            console.log("  publicValues length:", mockPublicValues.length);
            
            // Try to decode the public values to verify they're correct
            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
                ['bytes32', 'bytes32', 'uint256', 'uint64'],
                mockPublicValues
            );
            console.log("Decoded public values:");
            console.log("  commitment:", decoded[0]);
            console.log("  merkleRoot:", decoded[1]);
            console.log("  minBalance:", decoded[2].toString());
            console.log("  assetId:", decoded[3].toString());
            
            // Check if the values match expectations
            console.log("\nValidation:");
            console.log("  Commitment matches:", decoded[0] === commitment);
            console.log("  Merkle root matches:", decoded[1] === merkleRoot);
            console.log("  Min balance >= amount:", decoded[2] >= 12000000n);
            console.log("  Asset ID matches:", decoded[3] === 150n);
            
            const gasEstimate = await contract.withdraw.estimateGas(
                nullifier,
                "0xa8b90cef0e388a23cf2d3625481ce14d7c53750d",
                150,
                12000000,
                mockProofBytes,
                mockPublicValues
            );
            console.log("Gas estimate successful:", gasEstimate.toString());
        } catch (err) {
            console.log("Gas estimation failed:", err.message);
            console.log("Error code:", err.code);
            console.log("Error reason:", err.reason);
            
            // Try to call the function with debugging
            try {
                await contract.withdraw.staticCall(
                    nullifier,
                    "0xa8b90cef0e388a23cf2d3625481ce14d7c53750d",
                    150,
                    12000000,
                    mockProofBytes,
                    mockPublicValues
                );
                console.log("Static call successful - this shouldn't happen if gas estimation failed");
            } catch (staticErr) {
                console.log("Static call also failed:", staticErr.message);
                
                // Check each requirement individually
                console.log("\n=== Individual Checks ===");
                
                // Check 1: Nullifier not used
                const nullifierUsed = await contract.nullifiers(nullifier);
                console.log("1. Nullifier used check:", !nullifierUsed ? "✅ PASS" : "❌ FAIL");
                
                // Check 2: Try to decode and verify manually
                try {
                    const balanceProof = ethers.AbiCoder.defaultAbiCoder().decode(
                        ['bytes32', 'bytes32', 'uint256', 'uint64'],
                        mockPublicValues
                    );
                    
                    const currentMerkleRoot = await contract.getMerkleRoot();
                    console.log("2. Merkle root check:", balanceProof[1] === currentMerkleRoot ? "✅ PASS" : "❌ FAIL");
                    console.log("   Expected:", currentMerkleRoot);
                    console.log("   Got:", balanceProof[1]);
                    
                    console.log("3. Balance check:", balanceProof[2] >= 12000000n ? "✅ PASS" : "❌ FAIL");
                    console.log("   Min balance:", balanceProof[2].toString());
                    console.log("   Required:", "12000000");
                    
                    console.log("4. Asset check:", balanceProof[3] === 150n ? "✅ PASS" : "❌ FAIL");
                    console.log("   Asset ID:", balanceProof[3].toString());
                    
                } catch (decodeErr) {
                    console.log("Failed to decode public values:", decodeErr.message);
                }
            }
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