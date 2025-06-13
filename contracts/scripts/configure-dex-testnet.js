const hre = require("hardhat");

async function main() {
  console.log("Configuring Private DEX Extension for Testnet...");
  
  // Contract addresses
  const DEX_EXTENSION = "0x34CE8187a2903905aE4b0EF6f47F8D70A63C75Af";
  
  // Testnet token addresses from deployment
  const TESTNET_ADDRESSES = {
    WHYPE: "0x2ab8A4b3c496d8Ce56Fb6A28fd1Bec5b63fCF4d4", // TestWHYPE
    UBTC: "0x0000000000000000000000000000000000000000", // Not deployed yet - use zero address
    UETH: "0xB68B5A27fe8117837291617979b21ECbfbEAd2e3", // WETH9
    USDE: "0x53AD7C0aF66E852c181E8Af93086b2c88B30cb74", // Using TestUSDC as USDE
    ROUTER: "0xA8FAA918701e15c95A6df24DCA0CFB5Bcb1b44B7" // SwapRouter
  };
  
  // Get contract instance
  const dexExtension = await hre.ethers.getContractAt("PrivateDEXExtensionTestnet", DEX_EXTENSION);
  
  console.log("\nConfiguring tokens...");
  const tokenTx = await dexExtension.configureTokens(
    TESTNET_ADDRESSES.WHYPE,
    TESTNET_ADDRESSES.UBTC,
    TESTNET_ADDRESSES.UETH,
    TESTNET_ADDRESSES.USDE
  );
  await tokenTx.wait();
  console.log("✅ Tokens configured");
  
  console.log("\nSetting swap router...");
  const routerTx = await dexExtension.setSwapRouter(TESTNET_ADDRESSES.ROUTER);
  await routerTx.wait();
  console.log("✅ Router configured");
  
  console.log("\n📋 Configuration Summary:");
  console.log("- WHYPE (Token 0):", await dexExtension.tokenAddresses(0));
  console.log("- UBTC (Token 1):", await dexExtension.tokenAddresses(1));
  console.log("- UETH (Token 2):", await dexExtension.tokenAddresses(2));
  console.log("- USDE (Token 3):", await dexExtension.tokenAddresses(3));
  console.log("- Swap Router:", await dexExtension.swapRouter());
  
  console.log("\n✅ Testnet DEX Extension fully configured!");
  console.log("\n🎉 Ready for private swaps on testnet!");
  
  // Update config file
  const config = {
    privacySystem: "0xbfbC55261c22778686C2B44f596A6dA232Ae0779",
    dexExtension: DEX_EXTENSION,
    tokens: {
      HYPE: { id: 0, address: "0x0000000000000000000000000000000000000000", symbol: "HYPE", decimals: 18 },
      WHYPE: { id: 0, address: TESTNET_ADDRESSES.WHYPE, symbol: "WHYPE", decimals: 18 },
      UBTC: { id: 1, address: TESTNET_ADDRESSES.UBTC, symbol: "UBTC", decimals: 8 },
      WETH: { id: 2, address: TESTNET_ADDRESSES.UETH, symbol: "WETH", decimals: 18 },
      USDC: { id: 3, address: TESTNET_ADDRESSES.USDE, symbol: "USDC", decimals: 6 }
    },
    swapRouter: TESTNET_ADDRESSES.ROUTER,
    pools: {
      "WHYPE/USDC": "0x91774F1872c9aacE02d5678Cf81f375Be676C4C1"
    }
  };
  
  console.log("\n📄 Frontend configuration:");
  console.log(JSON.stringify(config, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });