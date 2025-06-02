const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    
    // Get contract addresses
    const mockVerifierAddress = "0xC55664b68E495Cd32BFFdAf53b881a60A5baCfd5";
    const verificationKeysAddress = "0xc024F36a1Ae5622f3AF340bE1734d25C74Ea5b3C";
    
    console.log("Testing SP1 Verifier directly...");
    
    try {
        const MockSP1Verifier = await ethers.getContractFactory("MockSP1Verifier");
        const mockVerifier = MockSP1Verifier.attach(mockVerifierAddress);
        
        const InnocenceVerificationKeys = await ethers.getContractFactory("InnocenceVerificationKeys");
        const vkeys = InnocenceVerificationKeys.attach(verificationKeysAddress);
        
        // Get the balance verification key
        const balanceVkey = await vkeys.BALANCE_VKEY();
        console.log("Balance VKey:", balanceVkey);
        
        // Test data from the failed withdrawal
        const mockProofBytes = "0x7df4f31049d764457237e59c0a83e16a1dc9891d78feddfaf950ba2fcf573f327df4f31049d764457237e59c0a83e16a1dc9891d78feddfaf950ba2fcf573f32";
        const mockPublicValues = "0x4e5ee6d33f4321419a609fa2d433a65aed4ec7aa06c97e61135fe418cc879c9674659c612b79d47471778de7976739638c107911fcf9ad28018ae4ba4388bc5a0000000000000000000000000000000000000000000000000000000000b71b000000000000000000000000000000000000000000000000000000000000000096";
        
        console.log("Testing verification with:");
        console.log("  VKey:", balanceVkey);
        console.log("  Public values length:", mockPublicValues.length);
        console.log("  Proof bytes length:", mockProofBytes.length);
        
        // Test the verification directly
        try {
            await mockVerifier.verifyProof(balanceVkey, mockPublicValues, mockProofBytes);
            console.log("✅ Direct verification successful!");
        } catch (verifyErr) {
            console.log("❌ Direct verification failed:", verifyErr.message);
            console.log("Error code:", verifyErr.code);
            console.log("Error data:", verifyErr.data);
            
            // Check alwaysValid setting
            const alwaysValid = await mockVerifier.alwaysValid();
            console.log("AlwaysValid setting:", alwaysValid);
            
            if (!alwaysValid) {
                console.log("Setting alwaysValid to true...");
                const tx = await mockVerifier.setAlwaysValid(true);
                await tx.wait();
                console.log("Now trying verification again...");
                
                try {
                    await mockVerifier.verifyProof(balanceVkey, mockPublicValues, mockProofBytes);
                    console.log("✅ Verification successful after setting alwaysValid!");
                } catch (retryErr) {
                    console.log("❌ Verification still failing:", retryErr.message);
                }
            }
        }
        
        // Also test with a simpler proof
        console.log("\n=== Testing with minimal proof ===");
        const simpleProof = "0x" + "ab".repeat(64);
        const simplePublicValues = "0x" + "00".repeat(32);
        
        try {
            await mockVerifier.verifyProof(balanceVkey, simplePublicValues, simpleProof);
            console.log("✅ Simple verification successful!");
        } catch (simpleErr) {
            console.log("❌ Simple verification failed:", simpleErr.message);
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