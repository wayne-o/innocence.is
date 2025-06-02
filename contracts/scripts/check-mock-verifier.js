const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    
    // Get mock verifier address from deployment
    const mockVerifierAddress = "0xC55664b68E495Cd32BFFdAf53b881a60A5baCfd5";
    
    console.log("Checking Mock SP1 Verifier at:", mockVerifierAddress);
    
    try {
        const MockSP1Verifier = await ethers.getContractFactory("MockSP1Verifier");
        const mockVerifier = MockSP1Verifier.attach(mockVerifierAddress);
        
        // Check if alwaysValid is true
        const alwaysValid = await mockVerifier.alwaysValid();
        console.log("AlwaysValid setting:", alwaysValid);
        
        if (!alwaysValid) {
            console.log("⚠️  Mock verifier is NOT set to always valid!");
            console.log("Setting alwaysValid to true...");
            
            const tx = await mockVerifier.setAlwaysValid(true);
            await tx.wait();
            console.log("✅ Mock verifier set to always valid");
        } else {
            console.log("✅ Mock verifier is properly configured");
        }
        
        // Test a simple proof verification
        console.log("\n=== Testing Proof Verification ===");
        try {
            const testVkey = "0x" + "11".repeat(32);
            const testPublicValues = "0x" + "22".repeat(32);
            const testProofBytes = "0x" + "33".repeat(64);
            
            await mockVerifier.verifyProof(testVkey, testPublicValues, testProofBytes);
            console.log("✅ Test proof verification successful");
        } catch (err) {
            console.log("❌ Test proof verification failed:", err.message);
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