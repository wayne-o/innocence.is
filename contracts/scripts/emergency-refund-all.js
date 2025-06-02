const { ethers } = require("hardhat");

async function main() {
    const contractAddress = "0x38957E2052AfFff204C4EA8Ae88cDA805C58B7b9";
    
    console.log("=== EMERGENCY REFUND ALL FUNDS ===");
    console.log("Contract:", contractAddress);
    
    try {
        const [deployer] = await ethers.getSigners();
        console.log("Authority:", deployer.address);
        
        const HyperliquidPrivacySystemEVMWithRecovery = await ethers.getContractFactory("HyperliquidPrivacySystemEVMWithRecovery");
        const contract = HyperliquidPrivacySystemEVMWithRecovery.attach(contractAddress);
        
        // Check current state
        const contractBalance = await ethers.provider.getBalance(contractAddress);
        const complianceAuthority = await contract.complianceAuthority();
        
        console.log("Contract ETH balance:", ethers.formatEther(contractBalance), "ETH");
        console.log("Compliance authority:", complianceAuthority);
        console.log("Are you authorized?", deployer.address.toLowerCase() === complianceAuthority.toLowerCase());
        
        if (deployer.address.toLowerCase() !== complianceAuthority.toLowerCase()) {
            console.log("❌ You are not the compliance authority - cannot perform emergency withdrawal");
            return;
        }
        
        if (contractBalance === BigInt(0)) {
            console.log("✅ No funds to refund - contract balance is 0");
            return;
        }
        
        console.log("\n=== Executing Emergency Withdrawal ===");
        console.log("Withdrawing", ethers.formatEther(contractBalance), "ETH to:", deployer.address);
        
        // Use the emergencyWithdrawAll function
        const emergencyTx = await contract.emergencyWithdrawAll(
            deployer.address,
            "Emergency refund of all funds as requested by user"
        );
        
        console.log("Emergency withdrawal transaction:", emergencyTx.hash);
        console.log("Waiting for confirmation...");
        
        const receipt = await emergencyTx.wait();
        console.log("✅ Emergency withdrawal confirmed!");
        console.log("Block number:", receipt.blockNumber);
        console.log("Gas used:", receipt.gasUsed.toString());
        
        // Check final balances
        const finalContractBalance = await ethers.provider.getBalance(contractAddress);
        const userBalance = await ethers.provider.getBalance(deployer.address);
        
        console.log("\n=== Final State ===");
        console.log("Contract balance:", ethers.formatEther(finalContractBalance), "ETH");
        console.log("Your wallet balance:", ethers.formatEther(userBalance), "ETH");
        
        const refundedAmount = contractBalance - finalContractBalance;
        console.log("Amount refunded:", ethers.formatEther(refundedAmount), "ETH");
        
        if (finalContractBalance === BigInt(0)) {
            console.log("🎉 ALL FUNDS SUCCESSFULLY REFUNDED!");
            console.log("The contract is now empty and safe to ignore");
        } else {
            console.log("⚠️  Some funds may remain in contract");
        }
        
        // Log the emergency event
        console.log("\n=== Emergency Event Details ===");
        const events = receipt.logs;
        for (const log of events) {
            try {
                const parsed = contract.interface.parseLog(log);
                if (parsed && parsed.name === 'EmergencyWithdraw') {
                    console.log("EmergencyWithdraw event:");
                    console.log("- Recipient:", parsed.args.recipient);
                    console.log("- Amount:", ethers.formatEther(parsed.args.amount), "ETH");
                    console.log("- Reason:", parsed.args.reason);
                }
            } catch (e) {
                // Ignore logs that aren't from our contract
            }
        }
        
    } catch (error) {
        console.error("Emergency withdrawal failed:", error.message);
        
        if (error.message.includes("Only compliance authority")) {
            console.log("❌ Only the compliance authority can perform emergency withdrawals");
        } else if (error.message.includes("No ETH to withdraw")) {
            console.log("✅ Contract already empty - no funds to withdraw");
        } else {
            console.log("💡 Try again or check transaction status manually");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });