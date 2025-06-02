const hre = require("hardhat");

// Known SP1 verifier addresses from Succinct Labs
// Source: https://github.com/succinctlabs/sp1-contracts/tree/main/contracts/deployments
const KNOWN_SP1_VERIFIERS = {
  // Ethereum Mainnet
  "1": {
    SP1VerifierGateway: "0x3B6041173B80E77f038f3F2C0f9744f04837185e", // Example - replace with actual
    SP1VerifierGroth16: "0x...", // Replace with actual
    SP1VerifierPlonk: "0x..."    // Replace with actual
  },
  // Sepolia Testnet
  "11155111": {
    SP1VerifierGateway: "0x397A5f7f3dBd538f23DE225B51f532c34448dA9B",
    SP1VerifierGroth16: "0x...",
    SP1VerifierPlonk: "0x..."
  }
};

async function checkSP1Verifier() {
  console.log("🔍 Checking for SP1 Verifier on current network...\n");
  
  const chainId = await hre.ethers.provider.getNetwork().then(n => n.chainId);
  console.log(`Current Chain ID: ${chainId}`);
  
  // For Hyperliquid, we need to check if there's a deployed SP1 verifier
  if (chainId === 999n) {
    console.log("\n⚠️  Hyperliquid Mainnet Detected");
    console.log("\nTo deploy on Hyperliquid mainnet, you need to:");
    console.log("1. Check if Succinct Labs has deployed SP1 verifier on Hyperliquid");
    console.log("2. If not, you may need to:");
    console.log("   a) Deploy the SP1 verifier contracts yourself");
    console.log("   b) Use a cross-chain verification solution");
    console.log("   c) Contact Succinct Labs for Hyperliquid support");
    
    console.log("\n📋 Steps to get SP1 Verifier for Hyperliquid:");
    console.log("1. Visit: https://github.com/succinctlabs/sp1-contracts");
    console.log("2. Check deployments folder for chain ID 999");
    console.log("3. If not available, follow their deployment guide");
    console.log("4. Or contact Succinct Labs team on Discord/Twitter");
    
    // Try to check if verifier exists at common addresses
    const commonAddresses = [
      "0x3B6041173B80E77f038f3F2C0f9744f04837185e", // Common testnet address
      "0x397A5f7f3dBd538f23DE225B51f532c34448dA9B", // Sepolia gateway
    ];
    
    console.log("\n🔍 Checking common SP1 verifier addresses...");
    for (const addr of commonAddresses) {
      try {
        const code = await hre.ethers.provider.getCode(addr);
        if (code !== "0x") {
          console.log(`✅ Found contract at ${addr}`);
          console.log("   ⚠️  Verify this is the correct SP1 verifier!");
        } else {
          console.log(`❌ No contract at ${addr}`);
        }
      } catch (error) {
        console.log(`❌ Error checking ${addr}: ${error.message}`);
      }
    }
  } else if (chainId === 998n) {
    console.log("\n✅ Hyperliquid Testnet - Using mock verifier is acceptable");
    console.log("Current mock verifier: 0x3B6041173B80E77f038f3F2C0f9744f04837185e");
  }
  
  console.log("\n📚 Resources:");
  console.log("- SP1 Contracts: https://github.com/succinctlabs/sp1-contracts");
  console.log("- SP1 Docs: https://docs.succinct.xyz/docs/onchain-verification/overview");
  console.log("- Succinct Discord: https://discord.gg/succinct");
}

// Also check if we can deploy SP1 verifier ourselves
async function deploySP1VerifierInstructions() {
  console.log("\n📝 To deploy SP1 Verifier on Hyperliquid yourself:");
  console.log("1. Clone sp1-contracts repository:");
  console.log("   git clone https://github.com/succinctlabs/sp1-contracts");
  console.log("2. Install dependencies:");
  console.log("   cd sp1-contracts && forge install");
  console.log("3. Deploy the verifier contracts:");
  console.log("   forge script script/deploy/SP1Verifier.s.sol --rpc-url <HYPERLIQUID_RPC> --broadcast");
  console.log("4. Deploy the gateway contract:");
  console.log("   forge script script/deploy/SP1VerifierGateway.s.sol --rpc-url <HYPERLIQUID_RPC> --broadcast");
}

async function main() {
  await checkSP1Verifier();
  await deploySP1VerifierInstructions();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });