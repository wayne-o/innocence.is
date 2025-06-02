const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function main() {
    const downloadsPath = "/Users/waynedouglas/Downloads";
    const userAddress = "0x5Bd2F329C50860366c0E6D3b4227a422B66AD203";
    
    console.log("=== SCANNING OLD DEPOSIT FILES ===");
    console.log("Downloads path:", downloadsPath);
    console.log("User address:", userAddress);
    
    try {
        const provider = new ethers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');
        const privateKey = process.env.PRIVATE_KEY;
        const signer = new ethers.Wallet(privateKey, provider);
        
        // Read all JSON files in Downloads
        const files = fs.readdirSync(downloadsPath)
            .filter(file => file.endsWith('.json') && file.includes('innocence'))
            .sort();
        
        console.log(`Found ${files.length} potential deposit files:`);
        files.forEach(file => console.log(`  - ${file}`));
        
        const recoveryTargets = [];
        
        // Analyze each file
        for (const file of files) {
            try {
                const filePath = path.join(downloadsPath, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                console.log(`\n=== Analyzing ${file} ===`);
                console.log("Data:", data);
                
                if (data.commitment && data.secret && data.nullifier) {
                    // This looks like a deposit file - check if there's a contract address
                    let contractAddress = null;
                    
                    // Try to find contract address in various places
                    if (data.contractAddress) {
                        contractAddress = data.contractAddress;
                    } else if (data.contract) {
                        contractAddress = data.contract;
                    } else if (data.txHash) {
                        // Try to get contract address from transaction
                        try {
                            const tx = await provider.getTransaction(data.txHash);
                            if (tx) {
                                contractAddress = tx.to;
                            }
                        } catch (txError) {
                            console.log("Could not fetch transaction:", data.txHash);
                        }
                    }
                    
                    if (contractAddress) {
                        console.log("Contract address:", contractAddress);
                        
                        // Check if contract has funds
                        const balance = await provider.getBalance(contractAddress);
                        console.log("Contract balance:", ethers.formatEther(balance), "ETH");
                        
                        if (balance > 0) {
                            recoveryTargets.push({
                                file,
                                contractAddress,
                                balance: ethers.formatEther(balance),
                                commitment: data.commitment,
                                secret: data.secret,
                                nullifier: data.nullifier,
                                amount: data.amount,
                                asset: data.asset
                            });
                            console.log("✅ RECOVERABLE FUNDS FOUND!");
                        } else {
                            console.log("❌ Contract is empty");
                        }
                    } else {
                        console.log("❌ No contract address found");
                    }
                } else {
                    console.log("❌ Not a deposit file (missing commitment/secret/nullifier)");
                }
                
            } catch (error) {
                console.log(`❌ Error reading ${file}:`, error.message);
            }
        }
        
        // Summary
        console.log("\n=== RECOVERY SUMMARY ===");
        if (recoveryTargets.length > 0) {
            console.log(`Found ${recoveryTargets.length} contracts with recoverable funds:`);
            let totalRecoverable = 0;
            
            for (const target of recoveryTargets) {
                console.log(`\n📄 File: ${target.file}`);
                console.log(`💰 Contract: ${target.contractAddress}`);
                console.log(`💎 Balance: ${target.balance} ETH`);
                console.log(`🔑 Commitment: ${target.commitment}`);
                totalRecoverable += parseFloat(target.balance);
            }
            
            console.log(`\n💰 TOTAL RECOVERABLE: ${totalRecoverable.toFixed(6)} ETH`);
            
            // Check if we can do emergency withdrawal on these contracts
            console.log("\n=== CHECKING EMERGENCY WITHDRAWAL ACCESS ===");
            console.log("Your address:", signer.address);
            
            for (const target of recoveryTargets) {
                try {
                    // Try to check if we're the compliance authority
                    const code = await provider.getCode(target.contractAddress);
                    if (code !== "0x") {
                        console.log(`\n🔍 Contract ${target.contractAddress}:`);
                        console.log("  Has code - checking authority...");
                        
                        try {
                            // Try multiple contract interfaces
                            const interfaces = [
                                "function complianceAuthority() external view returns (address)",
                                "function emergencyWithdrawAll(address recipient, string calldata reason) external"
                            ];
                            
                            for (const iface of interfaces) {
                                try {
                                    const contract = new ethers.Contract(target.contractAddress, [iface], provider);
                                    if (iface.includes("complianceAuthority")) {
                                        const authority = await contract.complianceAuthority();
                                        console.log("  Compliance authority:", authority);
                                        console.log("  You are authority:", authority.toLowerCase() === signer.address.toLowerCase());
                                    }
                                } catch (methodError) {
                                    // Method doesn't exist
                                }
                            }
                        } catch (contractError) {
                            console.log("  Could not check authority");
                        }
                    } else {
                        console.log(`  Contract ${target.contractAddress} has no code (destroyed)`);
                    }
                } catch (error) {
                    console.log(`  Error checking contract: ${error.message}`);
                }
            }
            
            // Provide recovery instructions
            console.log("\n=== RECOVERY OPTIONS ===");
            console.log("1. 🆘 Emergency Withdrawal (if you're compliance authority)");
            console.log("2. 🔐 Private Withdrawal (using commitment data)");
            console.log("3. 📞 Contact Support (if neither works)");
            
        } else {
            console.log("❌ No recoverable funds found in deposit files");
            console.log("All contracts are either empty or files don't contain valid data");
        }
        
    } catch (error) {
        console.error("Scan error:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });