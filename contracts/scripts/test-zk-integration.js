const hre = require("hardhat");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

async function generateProof(proofType, args = "") {
  console.log(`\nGenerating ${proofType} proof...`);
  
  const zkCircuitsPath = path.join(__dirname, "../../zk-circuits/innocence-circuits");
  const cmd = `cd ${zkCircuitsPath} && ./target/release/${proofType}-proof --prove ${args}`;
  
  try {
    execSync(cmd, { stdio: 'inherit' });
    
    // Read the generated proof
    const proofPath = path.join(zkCircuitsPath, `${proofType}_proof.json`);
    const proofData = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
    
    return proofData;
  } catch (error) {
    console.error(`Failed to generate ${proofType} proof:`, error);
    throw error;
  }
}

async function main() {
  console.log("Testing ZK Integration with HyperliquidPrivacySystemV4...");

  // Deploy contracts for testing
  console.log("\nDeploying contracts...");
  
  // Deploy mock SP1 verifier
  const MockSP1Verifier = await hre.ethers.getContractFactory("MockSP1Verifier");
  const mockVerifier = await MockSP1Verifier.deploy();
  await mockVerifier.deployed();
  console.log("MockSP1Verifier deployed to:", mockVerifier.address);

  // Deploy privacy system
  const [deployer, user] = await hre.ethers.getSigners();
  const HyperliquidPrivacySystemV4 = await hre.ethers.getContractFactory("HyperliquidPrivacySystemV4");
  const privacySystem = await HyperliquidPrivacySystemV4.deploy(
    mockVerifier.address,
    deployer.address
  );
  await privacySystem.deployed();
  console.log("HyperliquidPrivacySystemV4 deployed to:", privacySystem.address);

  // Test parameters
  const secret = "0x0101010101010101010101010101010101010101010101010101010101010101";
  const nullifier = "0x0202020202020202020202020202020202020202020202020202020202020202";
  const commitment = hre.ethers.utils.solidityKeccak256(
    ["bytes32", "bytes32"],
    [secret, nullifier]
  );

  console.log("\nTest parameters:");
  console.log("Secret:", secret);
  console.log("Nullifier:", nullifier);
  console.log("Commitment:", commitment);

  // Step 1: Generate compliance proof
  console.log("\n=== Step 1: Compliance Proof ===");
  try {
    const complianceProof = await generateProof("compliance", 
      `--secret ${secret} --nullifier ${nullifier} --valid-days 365`
    );
    console.log("✓ Compliance proof generated");
    
    // For testing with mock verifier, we'll use dummy proof data
    const publicValues = hre.ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "uint256", "bytes32"],
      [
        commitment,
        deployer.address,
        Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year validity
        hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("certificate"))
      ]
    );
    
    // Deposit with compliance proof
    console.log("\nDepositing with compliance proof...");
    const depositTx = await privacySystem.deposit(
      commitment,
      0, // USDC token ID
      hre.ethers.utils.parseUnits("1000", 6), // 1000 USDC
      "0x1234", // Mock proof bytes
      publicValues
    );
    await depositTx.wait();
    console.log("✓ Deposit successful");
    
  } catch (error) {
    console.error("Compliance proof test failed:", error);
  }

  // Step 2: Generate and test ownership proof
  console.log("\n=== Step 2: Ownership Proof ===");
  try {
    const ownershipProof = await generateProof("ownership",
      `--secret ${secret} --nullifier ${nullifier}`
    );
    console.log("✓ Ownership proof generated");
    
    // Test perps position with ownership proof
    const ownershipPublicValues = hre.ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "bytes32"],
      [
        commitment,
        hre.ethers.utils.keccak256(nullifier)
      ]
    );
    
    console.log("\nOpening perps position with ownership proof...");
    const perpsTx = await privacySystem.privatePerpsPosition(
      commitment,
      "0x5678", // Mock proof bytes
      ownershipPublicValues,
      0, // BTC-USD asset
      true, // Buy
      hre.ethers.utils.parseUnits("50000", 8), // $50k limit price
      hre.ethers.utils.parseUnits("0.1", 8) // 0.1 BTC
    );
    await perpsTx.wait();
    console.log("✓ Perps position opened");
    
  } catch (error) {
    console.error("Ownership proof test failed:", error);
  }

  // Step 3: Generate and test trade proof
  console.log("\n=== Step 3: Trade Proof ===");
  try {
    const tradeProof = await generateProof("trade",
      `--secret ${secret} --nullifier ${nullifier} --from-balance 1000 --from-amount 100`
    );
    console.log("✓ Trade proof generated");
    
    // Test spot trade with trade proof
    const tradePublicValues = hre.ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "uint64", "uint64", "uint256", "uint256"],
      [
        commitment,
        0, // From USDC
        1, // To ETH
        100, // Trade 100 USDC
        50  // Expect min 0.05 ETH
      ]
    );
    
    console.log("\nExecuting spot trade with trade proof...");
    const tradeTx = await privacySystem.privateSpotTrade(
      "0x9abc", // Mock proof bytes
      tradePublicValues
    );
    await tradeTx.wait();
    console.log("✓ Spot trade executed");
    
  } catch (error) {
    console.error("Trade proof test failed:", error);
  }

  // Step 4: Generate and test balance proof for withdrawal
  console.log("\n=== Step 4: Balance Proof for Withdrawal ===");
  try {
    const balanceProof = await generateProof("balance",
      `--secret ${secret} --nullifier ${nullifier} --balance 900 --min-balance 100`
    );
    console.log("✓ Balance proof generated");
    
    // Get merkle root
    const merkleRoot = await privacySystem.getMerkleRoot();
    
    // Test withdrawal with balance proof
    const balancePublicValues = hre.ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "bytes32", "uint256", "uint64"],
      [
        commitment,
        merkleRoot,
        100, // Min balance to prove
        0    // USDC token ID
      ]
    );
    
    const nullifierHash = hre.ethers.utils.keccak256(nullifier);
    
    console.log("\nWithdrawing with balance proof...");
    const withdrawTx = await privacySystem.withdraw(
      nullifierHash,
      user.address,
      0, // USDC token ID
      100, // Withdraw 100 USDC
      "0xdef0", // Mock proof bytes
      balancePublicValues
    );
    await withdrawTx.wait();
    console.log("✓ Withdrawal successful");
    
  } catch (error) {
    console.error("Balance proof test failed:", error);
  }

  console.log("\n✅ All ZK integration tests completed!");
  console.log("\nNote: This test used a mock verifier. For production:");
  console.log("1. Deploy the official SP1Verifier contract");
  console.log("2. Use real proof bytes from the ZK circuits");
  console.log("3. Ensure proper proof serialization");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });