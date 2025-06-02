const { ethers } = require("hardhat");

async function main() {
    const contractAddress = "0x38957E2052AfFff204C4EA8Ae88cDA805C58B7b9";
    
    console.log("=== Completing Fixed Deposit ===");
    console.log("Contract:", contractAddress);
    
    try {
        const [deployer] = await ethers.getSigners();
        console.log("User:", deployer.address);
        
        const HyperliquidPrivacySystemEVMWithRecovery = await ethers.getContractFactory("HyperliquidPrivacySystemEVMWithRecovery");
        const contract = HyperliquidPrivacySystemEVMWithRecovery.attach(contractAddress);
        
        // Check current state
        const contractBalance = await ethers.provider.getBalance(contractAddress);
        const pendingDeposit = await contract.getPendingDeposit(deployer.address);
        
        console.log("Contract balance:", ethers.formatEther(contractBalance), "ETH");
        console.log("Pending amount:", ethers.formatEther(pendingDeposit.amount), "ETH");
        console.log("Balance before:", ethers.formatEther(pendingDeposit.contractBalanceBefore), "ETH");
        
        // Calculate how much more ETH is needed
        const expectedAmount = BigInt(pendingDeposit.amount);
        const balanceBefore = BigInt(pendingDeposit.contractBalanceBefore);
        const currentBalance = contractBalance;
        const actualIncrease = currentBalance - balanceBefore;
        const needed = expectedAmount - actualIncrease;
        
        console.log("Expected increase:", ethers.formatEther(expectedAmount), "ETH");
        console.log("Actual increase:", ethers.formatEther(actualIncrease), "ETH");
        console.log("Additional needed:", ethers.formatEther(needed), "ETH");
        
        if (needed > 0) {
            console.log("\n=== Sending Additional ETH ===");
            console.log("Sending", ethers.formatEther(needed), "ETH to contract...");
            
            const sendTx = await deployer.sendTransaction({
                to: contractAddress,
                value: needed,
                gasLimit: 50000
            });
            
            console.log("Send ETH tx:", sendTx.hash);
            await sendTx.wait();
            
            const newBalance = await ethers.provider.getBalance(contractAddress);
            console.log("New contract balance:", ethers.formatEther(newBalance), "ETH");
        }
        
        // Check if deposit can be completed now
        const canComplete = await contract.canCompleteDeposit(deployer.address);
        console.log("Can complete deposit:", canComplete);
        
        if (canComplete) {
            console.log("\n=== Completing Deposit ===");
            
            const commitment = ethers.keccak256(ethers.toUtf8Bytes("final_fixed_deposit_" + Date.now()));
            const mockProof = "0x" + "ff".repeat(64);
            
            const compliancePublicValues = ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes32", "address", "uint256", "bytes32"],
                [
                    commitment,
                    deployer.address,
                    Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
                    ethers.keccak256(ethers.toUtf8Bytes("final_completion_certificate"))
                ]
            );
            
            const completeTx = await contract.completeDeposit(
                commitment,
                mockProof,
                compliancePublicValues
            );
            
            console.log("Complete tx:", completeTx.hash);
            const receipt = await completeTx.wait();
            
            console.log("🎉 DEPOSIT COMPLETED SUCCESSFULLY!");
            console.log("💾 Commitment:", commitment);
            console.log("Block:", receipt.blockNumber);
            console.log("Gas used:", receipt.gasUsed.toString());
            
            // Check events
            for (const log of receipt.logs) {
                try {
                    const parsed = contract.interface.parseLog(log);
                    if (parsed && parsed.name === 'PrivateDeposit') {
                        console.log("PrivateDeposit event - Commitment:", parsed.args.commitment);
                    }
                } catch (e) {}
            }
            
            console.log("\n✅ SUCCESS! Your latest 0.1 ETH is now private and committed!");
            
        } else {
            console.log("❌ Still cannot complete deposit");
            
            // Final diagnostic
            const finalBalance = await ethers.provider.getBalance(contractAddress);
            const finalIncrease = finalBalance - balanceBefore;
            console.log("Final balance:", ethers.formatEther(finalBalance), "ETH");
            console.log("Final increase:", ethers.formatEther(finalIncrease), "ETH");
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