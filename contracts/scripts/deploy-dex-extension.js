const hre = require("hardhat");

async function main() {
  console.log("Deploying Private DEX Extension...");
  
  // Use existing privacy system
  const PRIVACY_SYSTEM = "0xbfbC55261c22778686C2B44f596A6dA232Ae0779";
  
  // Deploy DEX extension
  const PrivateDEXExtension = await hre.ethers.getContractFactory("PrivateDEXExtension");
  const dexExtension = await PrivateDEXExtension.deploy(PRIVACY_SYSTEM);
  
  await dexExtension.waitForDeployment();
  const address = await dexExtension.getAddress();
  
  console.log("\n✅ Private DEX Extension deployed to:", address);
  console.log("\nConfiguration:");
  console.log("- Privacy System:", PRIVACY_SYSTEM);
  console.log("- Moonswap Router:", "0xEBd14cdF290185Cc4d0b5eC73A0e095d780e5D2f");
  
  console.log("\nToken mappings:");
  console.log("- HYPE/WHYPE: Token ID 0");
  console.log("- UBTC: Token ID 1 ->", await dexExtension.tokenAddresses(1));
  console.log("- UETH: Token ID 2 ->", await dexExtension.tokenAddresses(2));
  console.log("- USDE: Token ID 3 ->", await dexExtension.tokenAddresses(3));
  
  console.log("\n🎉 Ready for private swaps!");
  console.log("\nTo use:");
  console.log("1. Deposit tokens to privacy system");
  console.log("2. Call privateSwap on DEX extension");
  console.log("3. Balances remain private in the pool");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });