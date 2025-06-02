const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
    // Use environment variables and deployment info
    const contractAddress = "0x38957E2052AfFff204C4EA8Ae88cDA805C58B7b9";
    const userAddress = "0x5Bd2F329C50860366c0E6D3b4227a422B66AD203";
    const complianceAuthority = "0x5Bd2F329C50860366c0E6D3b4227a422B66AD203";
    
    console.log("=== EMERGENCY WITHDRAWAL ===");
    console.log("Contract:", contractAddress);
    console.log("Recipient:", userAddress);
    
    try {
        const provider = new ethers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');
        
        // Check current balance
        const contractBalance = await provider.getBalance(contractAddress);
        console.log("Contract balance:", ethers.formatEther(contractBalance), "ETH");
        
        if (contractBalance === BigInt(0)) {
            console.log("✅ Contract is already empty");
            return;
        }
        
        // Get the contract factory
        const HyperliquidPrivacySystemEVMWithRecovery = await ethers.getContractFactory("HyperliquidPrivacySystemEVMWithRecovery");
        
        // Use the compliance authority signer from environment
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            throw new Error("PRIVATE_KEY not found in environment variables");
        }
        
        const signer = new ethers.Wallet(privateKey, provider);
        console.log("Using signer:", signer.address);
        console.log("Expected compliance authority:", complianceAuthority);
        
        // Attach contract
        const contract = HyperliquidPrivacySystemEVMWithRecovery.attach(contractAddress).connect(signer);
        
        // Check compliance authority
        try {
            const complianceAuthority = await contract.complianceAuthority();
            console.log("Compliance authority:", complianceAuthority);
            console.log("Signer matches authority:", signer.address.toLowerCase() === complianceAuthority.toLowerCase());
        } catch (error) {
            console.log("Could not check compliance authority");
        }
        
        // Execute emergency withdrawal with fixed gas
        console.log("\n=== Executing Emergency Withdrawal ===");
        const tx = await signer.sendTransaction({
            to: contractAddress,
            data: contract.interface.encodeFunctionData("emergencyWithdrawAll", [
                userAddress,
                "Private withdrawal system needs fixing - emergency recovery"
            ]),
            gasLimit: 100000,
            gasPrice: 1000000000 // 1 gwei
        });
        
        console.log("Transaction submitted:", tx.hash);
        
        // Wait for confirmation
        const receipt = await tx.wait();
        console.log("Transaction confirmed in block:", receipt.blockNumber);
        
        // Check final balance
        const finalBalance = await provider.getBalance(contractAddress);
        const userBalance = await provider.getBalance(userAddress);
        
        console.log("\n=== Final Balances ===");
        console.log("Contract:", ethers.formatEther(finalBalance), "ETH");
        console.log("Your wallet:", ethers.formatEther(userBalance), "ETH");
        
        console.log("\n✅ Emergency withdrawal complete!");
        console.log("All funds have been recovered to your wallet");
        
    } catch (error) {
        console.error("Emergency withdrawal failed:", error.message);
        
        if (error.message.includes("Only compliance authority")) {
            console.log("\n❌ You need to be the compliance authority to perform emergency withdrawal");
            console.log("💡 Contact the system administrator for fund recovery");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });