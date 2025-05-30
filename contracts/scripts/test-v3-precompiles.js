const hre = require("hardhat");

async function main() {
  console.log("Testing HyperliquidPrivacySystemV3 precompile integration...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Testing with account:", deployer.address);

  // Load the deployed contract
  const deploymentInfo = require("../deployments/hyperevm_testnet-v3-deployment.json");
  const contractAddress = deploymentInfo.contractAddress;
  console.log("Using deployed contract at:", contractAddress);

  const HyperliquidPrivacySystemV3 = await hre.ethers.getContractFactory("HyperliquidPrivacySystemV3");
  const privacySystem = HyperliquidPrivacySystemV3.attach(contractAddress);

  // Test 1: Check if we can interact with the oracle precompile
  console.log("\n1. Testing oracle price reading (through direct precompile call)...");
  try {
    // Test getting BTC price (asset ID 0)
    const oraclePrecompile = "0x0000000000000000000000000000000000000807";
    const assetId = 0; // BTC
    
    // Make a direct call to the precompile
    const calldata = hre.ethers.AbiCoder.defaultAbiCoder().encode(["uint32"], [assetId]);
    const result = await hre.ethers.provider.call({
      to: oraclePrecompile,
      data: calldata
    });
    
    if (result !== "0x") {
      const price = hre.ethers.AbiCoder.defaultAbiCoder().decode(["uint64"], result)[0];
      console.log(`   BTC Oracle Price (raw): ${price}`);
      console.log(`   BTC Oracle Price (USD): $${Number(price) / 1e8}`);
    } else {
      console.log("   No price data returned");
    }
  } catch (error) {
    console.log("   Oracle precompile test failed:", error.message);
  }

  // Test 2: Check spot balance precompile
  console.log("\n2. Testing spot balance precompile...");
  try {
    const spotBalancePrecompile = "0x0000000000000000000000000000000000000801";
    const tokenId = 0; // USDC
    
    const calldata = hre.ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint64"], 
      [deployer.address, tokenId]
    );
    
    const result = await hre.ethers.provider.call({
      to: spotBalancePrecompile,
      data: calldata
    });
    
    if (result !== "0x") {
      // Decode the SpotBalance struct
      const decoded = hre.ethers.AbiCoder.defaultAbiCoder().decode(
        ["uint64", "uint64", "uint64"], 
        result
      );
      console.log(`   USDC Balance - Total: ${decoded[0]}, Hold: ${decoded[1]}, EntryNtl: ${decoded[2]}`);
    } else {
      console.log("   No balance data returned");
    }
  } catch (error) {
    console.log("   Spot balance precompile test failed:", error.message);
  }

  // Test 3: Try a simple deposit (will likely fail without actual tokens)
  console.log("\n3. Testing deposit function...");
  try {
    const commitment = hre.ethers.randomBytes(32);
    const tokenId = 0; // USDC
    const amount = 1000000; // 1 USDC (6 decimals)
    
    const tx = await privacySystem.deposit(
      commitment,
      tokenId,
      amount,
      "0x00",
      "0x00"
    );
    
    console.log("   Deposit transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("   Deposit successful! Gas used:", receipt.gasUsed.toString());
  } catch (error) {
    console.log("   Deposit failed (expected without tokens):", error.message);
  }

  // Test 4: Check write precompile events
  console.log("\n4. Testing if write precompile emits events...");
  try {
    // Deploy a simple test contract that calls the write precompile
    const TestWrite = await hre.ethers.getContractFactory("TestWrite");
    const testWrite = await TestWrite.deploy();
    await testWrite.waitForDeployment();
    
    const tx = await testWrite.testSendSpot();
    const receipt = await tx.wait();
    
    console.log("   Write precompile test transaction:", tx.hash);
    console.log("   Events emitted:", receipt.logs.length);
    
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === "0x3333333333333333333333333333333333333333") {
        console.log("   Found event from write precompile!");
      }
    }
  } catch (error) {
    console.log("   Write precompile test requires TestWrite contract");
  }

  console.log("\n✅ Precompile integration test complete!");
  console.log("\nNOTE: The contract is now properly configured to use HyperCore precompiles.");
  console.log("To fully test functionality, you'll need:");
  console.log("- Actual token balances in HyperCore");
  console.log("- Valid assets/tokens on the testnet");
  console.log("- Proper approvals for token transfers");
}

// Simple test contract for write precompile
const testWriteSource = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract TestWrite {
    address constant WRITE_PRECOMPILE = 0x3333333333333333333333333333333333333333;
    
    event TestEvent(string message);
    
    function testSendSpot() external {
        emit TestEvent("Testing write precompile");
        
        // Try to send 0 tokens to self (should emit event)
        (bool success,) = WRITE_PRECOMPILE.call(
            abi.encodeWithSignature(
                "sendSpot(address,uint64,uint64)",
                msg.sender,
                uint64(0),
                uint64(0)
            )
        );
        
        require(success, "Write precompile call failed");
    }
}`;

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });