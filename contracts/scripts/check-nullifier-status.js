const { ethers } = require("hardhat");

async function main() {
    const contractAddress = "0xcbc0a4A93a5FFe0C070Ab02b0Eb4bAB155E7669d";
    const nullifier = "0x9aca594b98443ed9b0490026acb2a859e17f2c78e8a5fa1a891491c63755f1a4";
    
    try {
        const HyperliquidPrivacySystem = await ethers.getContractFactory("HyperliquidPrivacySystemV5");
        const contract = HyperliquidPrivacySystem.attach(contractAddress);
        
        console.log("=== Nullifier Status Check ===");
        console.log("Contract:", contractAddress);
        console.log("Nullifier:", nullifier);
        
        // Check if nullifier is already used
        const isUsed = await contract.nullifiers(nullifier);
        console.log("Nullifier already used:", isUsed);
        
        if (isUsed) {
            console.log("❌ ISSUE FOUND: Nullifier has already been used!");
            console.log("This explains why the withdrawal is reverting.");
            console.log("Each commitment can only be withdrawn once.");
        } else {
            console.log("✅ Nullifier is available for use");
            
            // If nullifier is not used, check other potential issues
            console.log("\n=== Other Checks ===");
            
            // Check commitment exists
            const commitment = "0x4e5ee6d33f4321419a609fa2d433a65aed4ec7aa06c97e61135fe418cc879c96";
            const commitmentExists = await contract.commitments(commitment);
            console.log("Commitment exists:", commitmentExists);
            
            // Check merkle root
            const merkleRoot = await contract.getMerkleRoot();
            console.log("Current merkle root:", merkleRoot);
            
            // The issue might be in the proof verification or sendSpot precompile
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