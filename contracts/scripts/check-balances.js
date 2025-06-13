const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Checking balances...\n");

  // Contract addresses
  const addresses = {
    privacySystem: "0xC15D0a6Ca112a36283a309D801329Ade59CaBBA5",
    dexExtension: "0xa3F09EB1406209054FaC9EA6f4CA57F1B4b86260",
    testWHYPE: "0x1eBF615D720041AB0E64112d6dbc2ea9A71abEEa",
    testUSDC: "0xfC2348222447c85779Eebb46782335cdB5B56303",
    userWallet: "0xfB1Af79c5163cA0062F733A5184c831a8444E796" // Your actual wallet from frontend
  };

  // Token ABI
  const tokenABI = [
    "function balanceOf(address) view returns (uint256)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
  ];

  // Check TestWHYPE balances
  console.log("=== TestWHYPE Balances ===");
  const testWHYPE = new ethers.Contract(addresses.testWHYPE, tokenABI, signer);
  
  const userWHYPEBalance = await testWHYPE.balanceOf(addresses.userWallet);
  const privacyWHYPEBalance = await testWHYPE.balanceOf(addresses.privacySystem);
  const dexWHYPEBalance = await testWHYPE.balanceOf(addresses.dexExtension);
  
  console.log(`User Wallet: ${ethers.formatEther(userWHYPEBalance)} TestWHYPE`);
  console.log(`Privacy System: ${ethers.formatEther(privacyWHYPEBalance)} TestWHYPE`);
  console.log(`DEX Extension: ${ethers.formatEther(dexWHYPEBalance)} TestWHYPE`);

  // Check TestUSDC balances
  console.log("\n=== TestUSDC Balances ===");
  const testUSDC = new ethers.Contract(addresses.testUSDC, tokenABI, signer);
  
  const userUSDCBalance = await testUSDC.balanceOf(addresses.userWallet);
  const privacyUSDCBalance = await testUSDC.balanceOf(addresses.privacySystem);
  const dexUSDCBalance = await testUSDC.balanceOf(addresses.dexExtension);
  
  console.log(`User Wallet: ${ethers.formatUnits(userUSDCBalance, 6)} TestUSDC`);
  console.log(`Privacy System: ${ethers.formatUnits(privacyUSDCBalance, 6)} TestUSDC`);
  console.log(`DEX Extension: ${ethers.formatUnits(dexUSDCBalance, 6)} TestUSDC`);

  // Check if user needs tokens
  if (userWHYPEBalance == 0) {
    console.log("\n⚠️  You have no TestWHYPE tokens!");
    console.log("You need to get some TestWHYPE tokens before you can deposit.");
  }

  // Check commitments in privacy system
  console.log("\n=== Privacy System State ===");
  const privacySystemABI = [
    "function commitments(bytes32) view returns (bool)",
    "function getMerkleRoot() view returns (bytes32)"
  ];
  
  const privacySystem = new ethers.Contract(addresses.privacySystem, privacySystemABI, signer);
  const merkleRoot = await privacySystem.getMerkleRoot();
  console.log("Merkle Root:", merkleRoot);
  
  // Check a sample commitment from the logs
  const sampleCommitment = "0xcc4b7ee4efc2ffacf942deb019f96853e58b56fffc0af99414e1b6a310ddf028";
  const hasCommitment = await privacySystem.commitments(sampleCommitment);
  console.log(`Has commitment ${sampleCommitment}: ${hasCommitment}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });