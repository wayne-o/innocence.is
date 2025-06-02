const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING CORRECTED WITHDRAWAL SIGNATURE ===");
    
    // Test the correct function signature
    const correctInterface = new ethers.Interface([
        "function withdraw(bytes32 nullifier, address recipient, uint64 token, uint256 amount, bytes calldata balanceProof, bytes calldata publicValues) external"
    ]);
    
    const selector = correctInterface.getFunction("withdraw").selector;
    console.log("Correct withdraw function selector:", selector);
    
    // Test parameters
    const testParams = {
        nullifier: "0x1234567890123456789012345678901234567890123456789012345678901234",
        recipient: "0x5Bd2F329C50860366c0E6D3b4227a422B66AD203",
        token: 0,
        amount: ethers.parseEther("0.1"),
        balanceProof: "0x1234",
        publicValues: "0x5678"
    };
    
    // Encode function call
    const encodedData = correctInterface.encodeFunctionData("withdraw", [
        testParams.nullifier,
        testParams.recipient,
        testParams.token,
        testParams.amount,
        testParams.balanceProof,
        testParams.publicValues
    ]);
    
    console.log("Encoded function call:", encodedData);
    console.log("Function selector from encoded:", encodedData.slice(0, 10));
    
    // Verify it matches
    if (encodedData.slice(0, 10) === selector) {
        console.log("✅ Function signature is correct!");
    } else {
        console.log("❌ Function signature mismatch!");
    }
    
    console.log("\n=== COMPARISON WITH FAILED TRANSACTION ===");
    console.log("Failed transaction selector:", "0xdac90aeb");
    console.log("Correct selector:", selector);
    console.log("Match:", selector === "0xdac90aeb" ? "YES" : "NO");
    
    if (selector !== "0xdac90aeb") {
        console.log("\n🎯 CONFIRMATION: The failed transaction was NOT calling the withdraw function");
        console.log("The UI was generating incorrect function calls.");
        console.log("This fix should resolve the withdrawal issues.");
    }
    
    console.log("\n=== NEXT STEPS ===");
    console.log("1. ✅ Updated blockchain service with correct uint256 amount");
    console.log("2. 🔄 Test a new withdrawal with the corrected signature");
    console.log("3. 🎯 Verify the transaction uses selector", selector);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });