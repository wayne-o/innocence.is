const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Checking pool liquidity...\n");

  // Uniswap V3 Factory address on Hyperliquid testnet
  const factoryAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
  
  // Token addresses
  const tokens = {
    WHYPE: "0x2ab8A4b3c496d8Ce56Fb6A28fd1Bec5b63fCF4d4",
    WETH: "0xB68B5A27fe8117837291617979b21ECbfbEAd2e3",
    USDC: "0x53AD7C0aF66E852c181E8Af93086b2c88B30cb74"
  };

  // Factory ABI to get pools
  const factoryABI = [
    "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
  ];

  // Pool ABI to check liquidity
  const poolABI = [
    "function liquidity() external view returns (uint128)",
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function fee() external view returns (uint24)",
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
  ];

  const factory = new ethers.Contract(factoryAddress, factoryABI, signer);

  // Check common fee tiers
  const feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
  
  console.log("Checking WHYPE/USDC pools:");
  for (const fee of feeTiers) {
    try {
      const poolAddress = await factory.getPool(tokens.WHYPE, tokens.USDC, fee);
      if (poolAddress !== ethers.ZeroAddress) {
        const pool = new ethers.Contract(poolAddress, poolABI, signer);
        const liquidity = await pool.liquidity();
        const slot0 = await pool.slot0();
        
        console.log(`\nFee tier ${fee/10000}%:`);
        console.log(`  Pool address: ${poolAddress}`);
        console.log(`  Liquidity: ${liquidity.toString()}`);
        console.log(`  Current price (sqrtPriceX96): ${slot0.sqrtPriceX96.toString()}`);
        console.log(`  Unlocked: ${slot0.unlocked}`);
      } else {
        console.log(`\nFee tier ${fee/10000}%: No pool exists`);
      }
    } catch (error) {
      console.log(`\nFee tier ${fee/10000}%: Error - ${error.message}`);
    }
  }

  console.log("\n\nChecking WHYPE/WETH pools:");
  for (const fee of feeTiers) {
    try {
      const poolAddress = await factory.getPool(tokens.WHYPE, tokens.WETH, fee);
      if (poolAddress !== ethers.ZeroAddress) {
        const pool = new ethers.Contract(poolAddress, poolABI, signer);
        const liquidity = await pool.liquidity();
        
        console.log(`\nFee tier ${fee/10000}%:`);
        console.log(`  Pool address: ${poolAddress}`);
        console.log(`  Liquidity: ${liquidity.toString()}`);
      } else {
        console.log(`\nFee tier ${fee/10000}%: No pool exists`);
      }
    } catch (error) {
      console.log(`\nFee tier ${fee/10000}%: Error - ${error.message}`);
    }
  }

  // Check token balances in the swap router
  const swapRouter = "0xA8FAA918701e15c95A6df24DCA0CFB5Bcb1b44B7";
  const tokenABI = ["function balanceOf(address) view returns (uint256)"];
  
  console.log("\n\nSwap Router token balances:");
  for (const [name, address] of Object.entries(tokens)) {
    const token = new ethers.Contract(address, tokenABI, signer);
    const balance = await token.balanceOf(swapRouter);
    console.log(`${name}: ${ethers.formatUnits(balance, name === 'USDC' ? 6 : 18)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });