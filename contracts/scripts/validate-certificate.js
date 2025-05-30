const hre = require("hardhat");

async function main() {
  const contractAddress = "0x2ad7C1a28cC4b1925fD6A518ed07b34385Be005e";
  const userAddress = "0x5Bd2F329C50860366c0E6D3b4227a422B66AD203"; // The address trying to deposit
  
  console.log("Validating certificate for user:", userAddress);
  
  // Get the signer (should be the compliance authority)
  const [signer] = await hre.ethers.getSigners();
  console.log("Compliance authority:", signer.address);
  
  // Get the contract instance
  const contract = await hre.ethers.getContractAt("HyperliquidPrivacySystemTestnet", contractAddress);
  
  // Validate the certificate
  const tx = await contract.validateCertificate(
    userAddress,
    "0x00", // dummy certificate
    "0x00"  // dummy signature
  );
  
  await tx.wait();
  console.log("Certificate validated successfully!");
  console.log("Transaction hash:", tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });