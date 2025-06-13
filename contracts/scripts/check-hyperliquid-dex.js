const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Checking Hyperliquid testnet DEX infrastructure...\n");

  // The swap router address from the .env
  const swapRouterAddress = "0xA8FAA918701e15c95A6df24DCA0CFB5Bcb1b44B7";
  
  // Try to identify what kind of DEX this is
  console.log("Swap Router:", swapRouterAddress);
  
  // Check if it's a contract
  const code = await ethers.provider.getCode(swapRouterAddress);
  console.log("Has code:", code !== "0x");
  
  if (code === "0x") {
    console.log("\n❌ No swap router deployed at this address!");
    console.log("This explains why swaps are failing - there's no DEX to execute the swaps.");
    return;
  }

  // Try to call some common DEX functions to identify the type
  const commonFunctions = [
    { name: "factory", sig: "function factory() view returns (address)" },
    { name: "WETH", sig: "function WETH() view returns (address)" },
    { name: "swapExactTokensForTokens", sig: "function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) returns (uint256[])" },
    { name: "exactInputSingle", sig: "function exactInputSingle(tuple(address,address,uint24,address,uint256,uint256,uint256,uint160)) returns (uint256)" }
  ];

  for (const func of commonFunctions) {
    try {
      const contract = new ethers.Contract(swapRouterAddress, [func.sig], signer);
      const result = await contract[func.name]();
      console.log(`\n✓ ${func.name}() exists`);
      if (result) console.log(`  Result: ${result}`);
    } catch (error) {
      console.log(`\n✗ ${func.name}() - not found or errored`);
    }
  }

  // Check Hyperliquid's native spot trading precompile
  console.log("\n\nChecking Hyperliquid Spot Trading Precompile:");
  const SPOT_BALANCE = "0x0000000000000000000000000000000000000801";
  const spotCode = await ethers.provider.getCode(SPOT_BALANCE);
  console.log("Spot Balance Precompile has code:", spotCode !== "0x");

  // Token addresses
  const tokens = {
    WHYPE: "0x2ab8A4b3c496d8Ce56Fb6A28fd1Bec5b63fCF4d4",
    USDC: "0x53AD7C0aF66E852c181E8Af93086b2c88B30cb74"
  };

  // Check token deployments
  console.log("\n\nChecking token deployments:");
  for (const [name, address] of Object.entries(tokens)) {
    const code = await ethers.provider.getCode(address);
    console.log(`${name} (${address}): ${code !== "0x" ? "✓ Deployed" : "✗ Not deployed"}`);
    
    if (code !== "0x") {
      try {
        const token = new ethers.Contract(address, [
          "function totalSupply() view returns (uint256)",
          "function decimals() view returns (uint8)",
          "function balanceOf(address) view returns (uint256)"
        ], signer);
        
        const totalSupply = await token.totalSupply();
        const decimals = await token.decimals();
        console.log(`  Total Supply: ${ethers.formatUnits(totalSupply, decimals)}`);
        console.log(`  Decimals: ${decimals}`);
        
        // Check deployer's balance
        const balance = await token.balanceOf(signer.address);
        console.log(`  Your balance: ${ethers.formatUnits(balance, decimals)}`);
      } catch (error) {
        console.log(`  Error reading token: ${error.message}`);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });