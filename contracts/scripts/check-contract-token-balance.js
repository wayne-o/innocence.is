const { ethers } = require("hardhat");

async function main() {
    console.log("Checking contract token balance...");
    
    const contractAddress = "0xcbc0a4A93a5FFe0C070Ab02b0Eb4bAB155E7669d";
    const token = 150; // HYPE
    
    try {
        // Use the spot balance precompile to check contract balance
        const SPOT_BALANCE_PRECOMPILE = "0x000000000000000000000000000000000000C0BE";
        
        const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint64'],
            [contractAddress, token]
        );
        
        console.log("Calling spot balance precompile...");
        console.log("Contract:", contractAddress);
        console.log("Token:", token);
        
        const result = await ethers.provider.call({
            to: SPOT_BALANCE_PRECOMPILE,
            data: encoded
        });
        
        console.log("Raw result:", result);
        
        if (result === "0x") {
            console.log("❌ Empty result - precompile may not be available or contract has no balance");
            return;
        }
        
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint64', 'uint64', 'uint64'], result);
        const [total, hold, entryNtl] = decoded;
        
        console.log("\n=== Contract Balance ===");
        console.log("Total:", total.toString(), "units");
        console.log("Hold:", hold.toString(), "units");
        console.log("Entry NTL:", entryNtl.toString());
        
        const balanceInHype = Number(total) / 100000000; // Convert from 8 decimals
        console.log("Total in HYPE:", balanceInHype.toFixed(8));
        
        // Check if contract has enough for withdrawal
        const withdrawalAmount = 100000; // 0.001 HYPE in units
        console.log("\nWithdrawal check:");
        console.log("Withdrawal amount:", withdrawalAmount, "units");
        console.log("Contract has enough:", total >= withdrawalAmount);
        
        if (total < withdrawalAmount) {
            console.log("❌ ISSUE: Contract doesn't have enough balance for withdrawal!");
            console.log("This could be why sendSpot is failing.");
        } else {
            console.log("✅ Contract has sufficient balance");
        }
        
        // Also check if the contract holds any tokens at all
        if (total === 0n) {
            console.log("❌ WARNING: Contract has zero token balance!");
            console.log("The contract may need tokens deposited before withdrawals can work.");
        }
        
    } catch (error) {
        console.error("Error checking balance:", error.message);
        
        // Also try to check if the precompile is available
        console.log("\nTrying to verify precompile availability...");
        try {
            const code = await ethers.provider.getCode(SPOT_BALANCE_PRECOMPILE);
            console.log("Spot balance precompile code length:", code.length);
            console.log("Precompile exists:", code !== "0x");
        } catch (precompileErr) {
            console.log("Error checking precompile:", precompileErr.message);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });