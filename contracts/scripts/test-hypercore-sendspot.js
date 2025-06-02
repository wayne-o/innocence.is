const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    
    console.log("Testing HyperCore sendSpot functionality...");
    console.log("Deployer:", deployer.address);
    
    const contractAddress = "0xcbc0a4A93a5FFe0C070Ab02b0Eb4bAB155E7669d";
    
    try {
        const HyperliquidPrivacySystem = await ethers.getContractFactory("HyperliquidPrivacySystemV5");
        const contract = HyperliquidPrivacySystem.attach(contractAddress);
        
        // Check current contract balance for HYPE (token 150)
        // Use the same precompile call as the blockchain service
        const SPOT_BALANCE_PRECOMPILE = "0x000000000000000000000000000000000000C0BE";
        const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint64'],
            [contractAddress, 150]
        );
        
        const provider = ethers.provider;
        const result = await provider.call({
            to: SPOT_BALANCE_PRECOMPILE,
            data: encoded
        });
        
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint64', 'uint64', 'uint64'], result);
        const contractBalance = decoded[0];
        
        console.log("Contract HYPE balance:", contractBalance.toString(), "units");
        console.log("Contract HYPE balance:", (Number(contractBalance) / 100000000).toFixed(8), "HYPE");
        
        // Check if balance is sufficient for withdrawal
        const withdrawAmount = 12000000; // 0.12 HYPE
        console.log("Withdrawal amount:", withdrawAmount, "units");
        console.log("Sufficient balance:", contractBalance >= withdrawAmount);
        
        // Check the HyperCore write contract address
        console.log("\n=== Checking HyperCore Write Integration ===");
        try {
            // The contract should have a HYPERCORE_WRITE constant
            // Let's see if we can find what address it's using
            
            // Try to get the address by looking at recent sendSpot calls
            // We'll check the events or bytecode
            const code = await provider.getCode(contractAddress);
            console.log("Contract bytecode length:", code.length);
            
            // Check if the contract is properly configured for HyperCore
            // The HyperCore write address should be 0x0000000000000000000000000000000000000C0d
            const hyperCoreWriteAddress = "0x0000000000000000000000000000000000000C0d";
            const hyperCoreCode = await provider.getCode(hyperCoreWriteAddress);
            
            console.log("HyperCore Write exists:", hyperCoreCode !== "0x");
            console.log("HyperCore Write address:", hyperCoreWriteAddress);
            
            if (hyperCoreCode === "0x") {
                console.log("❌ HyperCore Write precompile not available!");
                console.log("This might be why the withdrawal is failing.");
            } else {
                console.log("✅ HyperCore Write precompile is available");
            }
            
        } catch (err) {
            console.log("Error checking HyperCore:", err.message);
        }
        
        // Try to simulate just the sendSpot call part
        console.log("\n=== Testing sendSpot simulation ===");
        
        // Create a simple contract that just calls sendSpot
        const testContract = `
            pragma solidity ^0.8.19;
            
            interface IHyperCoreWrite {
                function sendSpot(address destination, uint64 token, uint64 _wei) external;
            }
            
            contract TestSendSpot {
                IHyperCoreWrite constant HYPERCORE_WRITE = IHyperCoreWrite(0x0000000000000000000000000000000000000C0d);
                
                function testSend(address recipient, uint64 token, uint64 amount) external {
                    HYPERCORE_WRITE.sendSpot(recipient, token, amount);
                }
            }
        `;
        
        console.log("To test sendSpot, we'd need to deploy a test contract.");
        console.log("For now, this suggests the issue is likely with the sendSpot call.");
        
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