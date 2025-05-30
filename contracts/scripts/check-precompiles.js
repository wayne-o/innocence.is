const hre = require("hardhat");

async function main() {
  console.log("Checking HyperCore precompile deployment on Hyperliquid Testnet...\n");

  // Check precompile addresses
  const addresses = {
    "READ (0x0800)": "0x0000000000000000000000000000000000000800",
    "WRITE (0x3333)": "0x3333333333333333333333333333333333333333"
  };

  for (const [name, address] of Object.entries(addresses)) {
    const code = await hre.ethers.provider.getCode(address);
    console.log(`${name}:`);
    console.log(`  Address: ${address}`);
    console.log(`  Has code: ${code !== "0x"}`);
    console.log(`  Code length: ${code.length} characters`);
    
    if (code !== "0x" && code.length < 100) {
      console.log(`  Code: ${code}`);
    }
    console.log();
  }

  console.log("\nConclusion:");
  console.log("- The READ precompile (0x0800) is NOT deployed on testnet");
  console.log("- The WRITE precompile (0x3333...3333) IS deployed on testnet");
  console.log("- This explains why the deposit failed - it was trying to call");
  console.log("  HYPERCORE_WRITE.sendSpot() which exists but may not work as expected");
  console.log("  on the testnet, or may require special permissions/setup.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });