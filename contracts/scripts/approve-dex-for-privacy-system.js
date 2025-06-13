const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Setting up DEX approvals with account:", signer.address);

  // Contract addresses
  const privacySystemAddress = "0xbfbC55261c22778686C2B44f596A6dA232Ae0779";
  const dexExtensionAddress = "0xa9B4361F87d661f2025DD121423727Df08fef883";
  
  // Token addresses
  const tokens = {
    WHYPE: "0x2ab8A4b3c496d8Ce56Fb6A28fd1Bec5b63fCF4d4",
    WETH: "0xB68B5A27fe8117837291617979b21ECbfbEAd2e3",
    USDC: "0x53AD7C0aF66E852c181E8Af93086b2c88B30cb74"
  };

  // Privacy System ABI for approveTokensForDEX function
  const privacySystemABI = [
    "function approveTokensForDEX(address dexExtension, address[] calldata tokens) external",
    "function owner() view returns (address)"
  ];

  const privacySystem = new ethers.Contract(privacySystemAddress, privacySystemABI, signer);

  // Check owner
  const owner = await privacySystem.owner();
  console.log("Privacy System owner:", owner);
  console.log("Current signer:", signer.address);

  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error("Error: You must be the owner to approve tokens for DEX");
    console.error("Please use the owner account:", owner);
    return;
  }

  // Approve all tokens for the DEX extension
  const tokenAddresses = Object.values(tokens);
  console.log("\nApproving tokens for DEX extension...");
  console.log("DEX Extension:", dexExtensionAddress);
  console.log("Tokens:", tokenAddresses);

  try {
    const tx = await privacySystem.approveTokensForDEX(dexExtensionAddress, tokenAddresses);
    console.log("Transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("✅ Tokens approved successfully!");
    console.log("Gas used:", receipt.gasUsed.toString());
  } catch (error) {
    console.error("Error approving tokens:", error);
    
    // If the function doesn't exist, we need to do it manually
    if (error.message.includes("approveTokensForDEX")) {
      console.log("\nPrivacy system doesn't have approveTokensForDEX function.");
      console.log("The privacy system contract needs to approve the DEX extension to spend its tokens.");
      console.log("\nYou need to either:");
      console.log("1. Add an approveTokensForDEX function to the privacy system contract");
      console.log("2. Manually approve each token from within the privacy system contract");
      console.log("3. Update the DEX extension to use a different token transfer mechanism");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });