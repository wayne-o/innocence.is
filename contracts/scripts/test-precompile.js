const hre = require("hardhat");

async function main() {
  console.log("Testing HyperCore precompiles on Hyperliquid Testnet...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Testing with account:", deployer.address);

  // Deploy test contract
  console.log("Deploying TestPrecompile contract...");
  const TestPrecompile = await hre.ethers.getContractFactory("TestPrecompile");
  const testContract = await TestPrecompile.deploy();
  await testContract.waitForDeployment();
  const contractAddress = await testContract.getAddress();
  console.log("TestPrecompile deployed to:", contractAddress);

  // Test if precompiles have code
  console.log("\n1. Testing if precompiles have code deployed...");
  const [readHasCode, writeHasCode] = await testContract.testPrecompileCode();
  console.log("   READ precompile (0x0800) has code:", readHasCode);
  console.log("   WRITE precompile (0x3333...3333) has code:", writeHasCode);

  // Test read precompile
  console.log("\n2. Testing READ precompile...");
  const readTx = await testContract.testReadPrecompile();
  const readReceipt = await readTx.wait();
  
  console.log("   Events from READ test:");
  for (const event of readReceipt.logs) {
    try {
      const parsed = testContract.interface.parseLog(event);
      if (parsed && parsed.name === 'TestResult') {
        console.log(`   - ${parsed.args.test}: ${parsed.args.success ? 'SUCCESS' : 'FAILED'} - ${parsed.args.data}`);
      }
    } catch (e) {}
  }

  // Test write precompile
  console.log("\n3. Testing WRITE precompile...");
  try {
    const writeTx = await testContract.testWritePrecompile();
    const writeReceipt = await writeTx.wait();
    
    console.log("   Events from WRITE test:");
    for (const event of writeReceipt.logs) {
      try {
        const parsed = testContract.interface.parseLog(event);
        if (parsed && parsed.name === 'TestResult') {
          console.log(`   - ${parsed.args.test}: ${parsed.args.success ? 'SUCCESS' : 'FAILED'} - ${parsed.args.data}`);
        }
      } catch (e) {}
    }
  } catch (error) {
    console.log("   WRITE test transaction failed:", error.message);
  }

  // Try direct calls to check if precompiles exist
  console.log("\n4. Checking precompile addresses directly...");
  const readCode = await hre.ethers.provider.getCode("0x0000000000000000000000000000000000000800");
  const writeCode = await hre.ethers.provider.getCode("0x3333333333333333333333333333333333333333");
  
  console.log("   READ precompile code length:", readCode.length);
  console.log("   WRITE precompile code length:", writeCode.length);
  
  if (readCode === "0x" && writeCode === "0x") {
    console.log("\n⚠️  CONCLUSION: HyperCore precompiles are NOT deployed on this testnet.");
    console.log("   This explains why the original contract failed - it was trying to call");
    console.log("   non-existent precompiles. The testnet version without precompiles is");
    console.log("   the correct approach for testing on this network.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });