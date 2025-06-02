const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
    const userAddress = "0x5Bd2F329C50860366c0E6D3b4227a422B66AD203";
    
    // All deployed contract addresses
    const contracts = [
        // Mainnet contracts
        { name: "Recovery System (current)", address: "0x38957E2052AfFff204C4EA8Ae88cDA805C58B7b9", rpc: "https://rpc.hyperliquid.xyz/evm" },
        { name: "Pure EVM System", address: "0x60564ff628987871EFFF0A2Ec8b6EF722895152e", rpc: "https://rpc.hyperliquid.xyz/evm" },
        { name: "Mainnet Mock", address: "0xcbc0a4A93a5FFe0C070Ab02b0Eb4bAB155E7669d", rpc: "https://rpc.hyperliquid.xyz/evm" },
        
        // Testnet contracts  
        { name: "Testnet V4", address: "0xAa8289Bd8754064335D47c22d02caD493E166e8b", rpc: "https://rpc.hyperliquid-testnet.xyz/evm" },
        { name: "Testnet V4 Mock", address: "0xacC79fde62224426c90A60ED034D568a235a7983", rpc: "https://rpc.hyperliquid-testnet.xyz/evm" },
        { name: "Testnet V5", address: "0x669E4933eE72a35eBC0c00f9C3084ce46e4424c4", rpc: "https://rpc.hyperliquid-testnet.xyz/evm" },
        { name: "Testnet V3", address: "0x62040EF8551cE0ad550fE9f37683E59db7603358", rpc: "https://rpc.hyperliquid-testnet.xyz/evm" },
        { name: "Testnet V2", address: "0x2ad7C1a28cC4b1925fD6A518ed07b34385Be005e", rpc: "https://rpc.hyperliquid-testnet.xyz/evm" },
        { name: "Testnet V1", address: "0xfD7FCf5156FAff31f9C74bb967Ec56583b814d31", rpc: "https://rpc.hyperliquid-testnet.xyz/evm" }
    ];
    
    console.log("=== CHECKING ALL CONTRACT BALANCES ===");
    console.log("User address:", userAddress);
    
    const recoverable = [];
    let totalRecoverable = 0;
    
    for (const contract of contracts) {
        try {
            console.log(`\n--- ${contract.name} ---`);
            console.log("Address:", contract.address);
            
            const provider = new ethers.JsonRpcProvider(contract.rpc);
            const balance = await provider.getBalance(contract.address);
            const balanceEth = parseFloat(ethers.formatEther(balance));
            
            console.log("Balance:", balanceEth, "ETH");
            
            if (balanceEth > 0) {
                console.log("🎯 FUNDS FOUND!");
                
                // Check if we're the compliance authority
                try {
                    const contractCode = await provider.getCode(contract.address);
                    if (contractCode !== "0x") {
                        console.log("Checking compliance authority...");
                        
                        // Try different ABI functions
                        const interfaces = [
                            "function complianceAuthority() external view returns (address)",
                            "function emergencyWithdrawAll(address recipient, string calldata reason) external"
                        ];
                        
                        let hasAuthority = false;
                        for (const iface of interfaces) {
                            try {
                                const contractInstance = new ethers.Contract(contract.address, [iface], provider);
                                if (iface.includes("complianceAuthority")) {
                                    const authority = await contractInstance.complianceAuthority();
                                    console.log("Compliance authority:", authority);
                                    hasAuthority = authority.toLowerCase() === userAddress.toLowerCase();
                                    console.log("You are authority:", hasAuthority);
                                    break;
                                }
                            } catch (methodError) {
                                // Method doesn't exist, try next
                            }
                        }
                        
                        recoverable.push({
                            name: contract.name,
                            address: contract.address,
                            balance: balanceEth,
                            rpc: contract.rpc,
                            hasAuthority,
                            network: contract.rpc.includes('testnet') ? 'testnet' : 'mainnet'
                        });
                        
                        totalRecoverable += balanceEth;
                    }
                } catch (authorityError) {
                    console.log("Could not check authority:", authorityError.message);
                    
                    // Still add to recoverable list for manual check
                    recoverable.push({
                        name: contract.name,
                        address: contract.address,
                        balance: balanceEth,
                        rpc: contract.rpc,
                        hasAuthority: null,
                        network: contract.rpc.includes('testnet') ? 'testnet' : 'mainnet'
                    });
                    
                    totalRecoverable += balanceEth;
                }
            } else {
                console.log("❌ Empty");
            }
            
        } catch (error) {
            console.log("❌ Error:", error.message);
        }
    }
    
    // Summary
    console.log("\n=== RECOVERY SUMMARY ===");
    if (recoverable.length > 0) {
        console.log(`🎯 Found ${recoverable.length} contracts with funds:`);
        console.log(`💰 Total recoverable: ${totalRecoverable.toFixed(6)} ETH`);
        
        console.log("\n=== BREAKDOWN ===");
        for (const item of recoverable) {
            console.log(`\n📍 ${item.name}`);
            console.log(`   Address: ${item.address}`);
            console.log(`   Network: ${item.network}`);
            console.log(`   Balance: ${item.balance} ETH`);
            console.log(`   Authority: ${item.hasAuthority === true ? '✅ Yes' : item.hasAuthority === false ? '❌ No' : '❓ Unknown'}`);
        }
        
        // Generate recovery commands
        console.log("\n=== RECOVERY COMMANDS ===");
        const privateKey = process.env.PRIVATE_KEY;
        
        for (const item of recoverable) {
            if (item.hasAuthority === true || item.hasAuthority === null) {
                console.log(`\n# Recover from ${item.name}:`);
                console.log(`# Network: ${item.network}`);
                console.log(`# Balance: ${item.balance} ETH`);
                console.log(`# You can try emergency withdrawal with this command:`);
                console.log(`node -e "
const { ethers } = require('ethers');
const provider = new ethers.JsonRpcProvider('${item.rpc}');
const signer = new ethers.Wallet('${privateKey}', provider);
const contract = new ethers.Contract('${item.address}', ['function emergencyWithdrawAll(address recipient, string calldata reason) external'], signer);
contract.emergencyWithdrawAll('${userAddress}', 'Fund recovery from old contract').then(tx => console.log('TX:', tx.hash)).catch(console.error);
"`);
            }
        }
        
    } else {
        console.log("❌ No recoverable funds found in any deployed contracts");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });