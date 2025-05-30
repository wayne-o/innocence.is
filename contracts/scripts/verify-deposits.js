const hre = require("hardhat");

async function main() {
  console.log("Verifying private deposits on Hyperliquid Testnet...\n");

  const [signer] = await hre.ethers.getSigners();
  console.log("Checking with account:", signer.address);

  // Load the deployed contract
  const contractAddress = "0x62040EF8551cE0ad550fE9f37683E59db7603358";
  console.log("Contract address:", contractAddress);

  const HyperliquidPrivacySystemV3 = await hre.ethers.getContractFactory("HyperliquidPrivacySystemV3");
  const privacySystem = HyperliquidPrivacySystemV3.attach(contractAddress);

  // Check contract state
  console.log("\n1. Checking contract configuration...");
  const complianceAuthority = await privacySystem.complianceAuthority();
  console.log("   Compliance Authority:", complianceAuthority);

  // Check if the user has a valid certificate
  console.log("\n2. Checking certificate validation...");
  const hasValidCert = await privacySystem.validCertificates(signer.address);
  console.log("   Your address has valid certificate:", hasValidCert);

  // Get merkle root
  console.log("\n3. Checking merkle tree state...");
  const merkleRoot = await privacySystem.getMerkleRoot();
  console.log("   Current merkle root:", merkleRoot);
  console.log("   Empty tree:", merkleRoot === "0x0000000000000000000000000000000000000000000000000000000000000000");

  // Check recent events
  console.log("\n4. Checking recent PrivateDeposit events...");
  const filter = privacySystem.filters.PrivateDeposit();
  const events = await privacySystem.queryFilter(filter, -1000); // Last 1000 blocks
  
  console.log(`   Found ${events.length} deposit events`);
  
  if (events.length > 0) {
    console.log("\n   Recent deposits:");
    for (let i = 0; i < Math.min(5, events.length); i++) {
      const event = events[events.length - 1 - i]; // Show most recent first
      const block = await event.getBlock();
      console.log(`   - Commitment: ${event.args[0]}`);
      console.log(`     Block: ${event.blockNumber}`);
      console.log(`     Timestamp: ${new Date(block.timestamp * 1000).toISOString()}`);
      console.log(`     Tx Hash: ${event.transactionHash}`);
      
      // Check if commitment is registered
      const isUsed = await privacySystem.commitments(event.args[0]);
      console.log(`     Commitment registered: ${isUsed}`);
      console.log();
    }
  }

  // Check specific commitments if provided
  const testCommitments = [
    // Add any specific commitments you want to check here
  ];

  if (testCommitments.length > 0) {
    console.log("\n5. Checking specific commitments...");
    for (const commitment of testCommitments) {
      const isUsed = await privacySystem.commitments(commitment);
      console.log(`   ${commitment}: ${isUsed ? 'REGISTERED' : 'NOT FOUND'}`);
    }
  }

  // Check balance on HyperCore
  console.log("\n6. Checking HyperCore balance...");
  try {
    const spotBalancePrecompile = "0x0000000000000000000000000000000000000801";
    const tokenId = 0; // USDC
    
    // Check contract's balance
    const calldata = hre.ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint64"], 
      [contractAddress, tokenId]
    );
    
    const result = await hre.ethers.provider.call({
      to: spotBalancePrecompile,
      data: calldata
    });
    
    if (result !== "0x") {
      const decoded = hre.ethers.AbiCoder.defaultAbiCoder().decode(
        ["uint64", "uint64", "uint64"], 
        result
      );
      console.log(`   Contract USDC Balance - Total: ${decoded[0]}, Hold: ${decoded[1]}`);
    }
  } catch (error) {
    console.log("   Could not check HyperCore balance:", error.message);
  }

  console.log("\n✅ Verification complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });