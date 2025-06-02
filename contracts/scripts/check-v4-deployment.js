const hre = require("hardhat");

async function main() {
  const contractAddress = "0xAa8289Bd8754064335D47c22d02caD493E166e8b";
  
  console.log("Checking V4 deployment at:", contractAddress);
  
  try {
    // Check if contract exists
    const code = await hre.ethers.provider.getCode(contractAddress);
    
    if (code === "0x") {
      console.log("❌ No contract deployed at this address!");
      return;
    }
    
    console.log("✅ Contract found!");
    console.log("Code length:", code.length);
    
    // Get contract instance
    const contract = await hre.ethers.getContractAt(
      "HyperliquidPrivacySystemV4",
      contractAddress
    );
    
    // Check basic functions
    console.log("\nChecking contract functions:");
    
    try {
      const authority = await contract.complianceAuthority();
      console.log("✅ Compliance Authority:", authority);
    } catch (e) {
      console.log("❌ Failed to get compliance authority:", e.message);
    }
    
    try {
      const verifier = await contract.sp1Verifier();
      console.log("✅ SP1 Verifier:", verifier);
      
      // Check if verifier is deployed
      const verifierCode = await hre.ethers.provider.getCode(verifier);
      if (verifierCode === "0x") {
        console.log("⚠️  WARNING: SP1 Verifier not deployed!");
      } else {
        console.log("✅ SP1 Verifier is deployed");
      }
    } catch (e) {
      console.log("❌ Failed to get SP1 verifier:", e.message);
    }
    
    try {
      const merkleRoot = await contract.getMerkleRoot();
      console.log("✅ Merkle Root:", merkleRoot);
    } catch (e) {
      console.log("❌ Failed to get merkle root:", e.message);
    }
    
  } catch (error) {
    console.error("Error:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });