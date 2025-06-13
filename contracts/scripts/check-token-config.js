const { ethers } = require("hardhat");

async function main() {
  const privacySystemAddress = "0x07Ee16F77aC3BbD59eAaAA1c262629C69B0752dA";
  
  const privacySystemABI = [
    "function tokenAddresses(uint64) view returns (address)",
    "function pendingDeposits(address) view returns (uint64 token, uint256 amount, uint256 contractBalanceBefore, uint256 timestamp, bool completed)"
  ];
  
  const provider = new ethers.JsonRpcProvider("https://rpc.hyperliquid-testnet.xyz/evm");
  const privacySystem = new ethers.Contract(privacySystemAddress, privacySystemABI, provider);
  
  console.log("Checking token configuration...\n");
  
  // Check token addresses
  console.log("Token 0 address:", await privacySystem.tokenAddresses(0));
  console.log("Token 1 address:", await privacySystem.tokenAddresses(1));
  console.log("Token 2 address:", await privacySystem.tokenAddresses(2));
  console.log("Token 3 address:", await privacySystem.tokenAddresses(3));
  
  // Check pending deposit
  const userAddress = "0xfB1Af79c5163cA0062F733A5184c831a8444E796";
  const pendingDeposit = await privacySystem.pendingDeposits(userAddress);
  
  console.log("\nPending deposit for user:", userAddress);
  console.log("Token:", pendingDeposit.token.toString());
  console.log("Amount:", pendingDeposit.amount.toString());
  console.log("Contract balance before:", pendingDeposit.contractBalanceBefore.toString());
  console.log("Timestamp:", pendingDeposit.timestamp.toString());
  console.log("Completed:", pendingDeposit.completed);
  
  // Check current TestWHYPE balance
  const testWHYPE = "0x1eBF615D720041AB0E64112d6dbc2ea9A71abEEa";
  const tokenABI = ["function balanceOf(address) view returns (uint256)"];
  const token = new ethers.Contract(testWHYPE, tokenABI, provider);
  const currentBalance = await token.balanceOf(privacySystemAddress);
  
  console.log("\nCurrent TestWHYPE balance of privacy system:", ethers.formatEther(currentBalance));
  
  if (pendingDeposit.timestamp > 0) {
    const expectedBalance = pendingDeposit.contractBalanceBefore + pendingDeposit.amount;
    console.log("Expected balance after deposit:", ethers.formatEther(expectedBalance));
    console.log("Balance increased?", currentBalance >= expectedBalance);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
EOF < /dev/null