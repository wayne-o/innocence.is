const { ethers } = require("hardhat");

async function main() {
  const privacySystemAddress = "0xC15D0a6Ca112a36283a309D801329Ade59CaBBA5";
  
  // Get the transaction receipt
  const provider = new ethers.JsonRpcProvider("https://rpc.hyperliquid-testnet.xyz/evm");
  const txHash = "0x23666e0bdd16b1c4b892aa82d31e9246f768b3121c908d7b7821f801e24c6f73";
  
  console.log("Checking deposit transaction...\n");
  
  const receipt = await provider.getTransactionReceipt(txHash);
  console.log("Transaction successful:", receipt.status === 1);
  console.log("Gas used:", receipt.gasUsed.toString());
  
  // Decode the logs
  const privacySystemABI = [
    "event PrivateDeposit(bytes32 indexed commitment, uint256 timestamp)"
  ];
  
  const iface = new ethers.Interface(privacySystemABI);
  
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === "PrivateDeposit") {
        console.log("\n✅ Deposit Event Found!");
        console.log("Commitment:", parsed.args[0]);
        console.log("Timestamp:", new Date(Number(parsed.args[1]) * 1000).toLocaleString());
        
        // Store this commitment for the swap
        console.log("\n💡 Use this commitment for your swap:", parsed.args[0]);
      }
    } catch (e) {
      // Not our event
    }
  }
  
  // Check ETH balance of privacy system
  const ethBalance = await provider.getBalance(privacySystemAddress);
  console.log("\nPrivacy System ETH balance:", ethers.formatEther(ethBalance), "ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });