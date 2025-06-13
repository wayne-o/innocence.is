const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Fixing token addresses with account:", signer.address);

  const privacySystemAddress = "0x07Ee16F77aC3BbD59eAaAA1c262629C69B0752dA";
  
  const privacySystemABI = [
    "function addToken(uint64 tokenId, address tokenAddress) external",
    "function tokenAddresses(uint64) view returns (address)"
  ];
  
  const privacySystem = new ethers.Contract(privacySystemAddress, privacySystemABI, signer);
  
  // Correct token addresses
  const newTokenAddresses = {
    0: "0x1eBF615D720041AB0E64112d6dbc2ea9A71abEEa", // TestWHYPE (NEW)
    2: "0x64C60400f1eB8F5a5287347075d20061eaf23deb", // WETH9 (NEW)
    3: "0xfC2348222447c85779Eebb46782335cdB5B56303"  // TestUSDC (NEW)
  };
  
  console.log("\nUpdating token addresses...");
  
  for (const [tokenId, address] of Object.entries(newTokenAddresses)) {
    console.log(`\nUpdating token ${tokenId} to ${address}`);
    const tx = await privacySystem.addToken(tokenId, address);
    await tx.wait();
    console.log("✅ Updated");
  }
  
  console.log("\nVerifying new configuration:");
  console.log("Token 0:", await privacySystem.tokenAddresses(0));
  console.log("Token 2:", await privacySystem.tokenAddresses(2));
  console.log("Token 3:", await privacySystem.tokenAddresses(3));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });