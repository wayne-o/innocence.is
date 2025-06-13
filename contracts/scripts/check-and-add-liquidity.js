const { ethers } = require("ethers");
require('dotenv').config();

// Connect to Hyperliquid testnet
const provider = new ethers.JsonRpcProvider("https://rpc.hyperliquid-testnet.xyz/evm");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || "0x1234567890123456789012345678901234567890123456789012345678901234", provider);

// Contract addresses
const SWAP_ROUTER = "0xA8FAA918701e15c95A6df24DCA0CFB5Bcb1b44B7";
const POSITION_MANAGER = "0x78C90C68d22228A67bD14050D887b42f9AE5D29f"; // From deploy-dex-integration.js
const FACTORY = "0xd5D5c06f60E5C957cDD9c3Eb87a15d0f5A37E70c"; // From deploy-dex-integration.js - fixed checksum

// Token addresses
const TOKENS = {
  WHYPE: "0x2ab8A4b3c496d8Ce56Fb6A28fd1Bec5b63fCF4d4",
  WETH: "0xB68B5A27fe8117837291617979b21ECbfbEAd2e3",
  USDC: "0x53AD7C0aF66E852c181E8Af93086b2c88B30cb74"
};

// ERC20 ABI for approval and balance checking
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

// Position Manager ABI for adding liquidity
const POSITION_MANAGER_ABI = [
  "function mint(tuple(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"
];

// Factory ABI to get pool
const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)"
];

// Pool ABI to check liquidity
const POOL_ABI = [
  "function liquidity() view returns (uint128)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function fee() view returns (uint24)"
];

async function checkAndAddLiquidity(token0Address, token1Address, fee = 3000) {
  console.log(`\nChecking liquidity for ${token0Address} / ${token1Address} pool (fee: ${fee/10000}%)...`);
  
  try {
    // Get pool address
    const factory = new ethers.Contract(FACTORY, FACTORY_ABI, wallet);
    const poolAddress = await factory.getPool(token0Address, token1Address, fee);
    
    if (poolAddress === ethers.ZeroAddress) {
      console.log("❌ Pool does not exist!");
      return false;
    }
    
    console.log(`Pool address: ${poolAddress}`);
    
    // Check pool liquidity
    const pool = new ethers.Contract(poolAddress, POOL_ABI, wallet);
    const liquidity = await pool.liquidity();
    console.log(`Current liquidity: ${liquidity.toString()}`);
    
    // Get pool state
    const slot0 = await pool.slot0();
    console.log(`Current tick: ${slot0.tick}`);
    console.log(`Current sqrtPriceX96: ${slot0.sqrtPriceX96.toString()}`);
    
    // If liquidity is low, add some
    if (liquidity < ethers.parseEther("1")) {
      console.log("\n⚠️  Low liquidity detected. Adding liquidity...");
      
      // Get tokens
      const token0 = new ethers.Contract(token0Address, ERC20_ABI, wallet);
      const token1 = new ethers.Contract(token1Address, ERC20_ABI, wallet);
      
      // Check balances
      const balance0 = await token0.balanceOf(wallet.address);
      const balance1 = await token1.balanceOf(wallet.address);
      const decimals0 = await token0.decimals();
      const decimals1 = await token1.decimals();
      const symbol0 = await token0.symbol();
      const symbol1 = await token1.symbol();
      
      console.log(`\nWallet balances:`);
      console.log(`${symbol0}: ${ethers.formatUnits(balance0, decimals0)}`);
      console.log(`${symbol1}: ${ethers.formatUnits(balance1, decimals1)}`);
      
      // Calculate amounts (add 10 tokens of each for now)
      const amount0Desired = ethers.parseUnits("10", decimals0);
      const amount1Desired = ethers.parseUnits("10", decimals1);
      
      if (balance0 < amount0Desired || balance1 < amount1Desired) {
        console.log("❌ Insufficient balance to add liquidity!");
        return false;
      }
      
      // Approve tokens
      console.log("\nApproving tokens...");
      const approve0Tx = await token0.approve(POSITION_MANAGER, amount0Desired);
      await approve0Tx.wait();
      console.log(`✓ ${symbol0} approved`);
      
      const approve1Tx = await token1.approve(POSITION_MANAGER, amount1Desired);
      await approve1Tx.wait();
      console.log(`✓ ${symbol1} approved`);
      
      // Add liquidity
      const positionManager = new ethers.Contract(POSITION_MANAGER, POSITION_MANAGER_ABI, wallet);
      
      // Calculate tick range (wide range around current tick)
      const tickSpacing = fee === 500 ? 10 : fee === 3000 ? 60 : 200;
      const currentTick = slot0.tick;
      const tickLower = Math.floor(currentTick / tickSpacing) * tickSpacing - tickSpacing * 10;
      const tickUpper = Math.floor(currentTick / tickSpacing) * tickSpacing + tickSpacing * 10;
      
      console.log(`\nAdding liquidity with tick range: ${tickLower} to ${tickUpper}`);
      
      const mintParams = {
        token0: token0Address < token1Address ? token0Address : token1Address,
        token1: token0Address < token1Address ? token1Address : token0Address,
        fee: fee,
        tickLower: tickLower,
        tickUpper: tickUpper,
        amount0Desired: token0Address < token1Address ? amount0Desired : amount1Desired,
        amount1Desired: token0Address < token1Address ? amount1Desired : amount0Desired,
        amount0Min: 0,
        amount1Min: 0,
        recipient: wallet.address,
        deadline: Math.floor(Date.now() / 1000) + 3600
      };
      
      const mintTx = await positionManager.mint(mintParams, { gasLimit: 500000 });
      const receipt = await mintTx.wait();
      
      console.log(`✓ Liquidity added! Tx: ${receipt.hash}`);
      
      // Check new liquidity
      const newLiquidity = await pool.liquidity();
      console.log(`New pool liquidity: ${newLiquidity.toString()}`);
      
      return true;
    } else {
      console.log("✓ Pool has sufficient liquidity");
      return true;
    }
    
  } catch (error) {
    console.error("Error checking/adding liquidity:", error.message);
    return false;
  }
}

async function main() {
  console.log("🔍 Checking and adding liquidity to DEX pools...");
  console.log(`Wallet address: ${wallet.address}`);
  
  // Check all token pairs
  const pairs = [
    { token0: TOKENS.WHYPE, token1: TOKENS.USDC, fee: 3000 },
    { token0: TOKENS.WHYPE, token1: TOKENS.WETH, fee: 3000 },
    { token0: TOKENS.WETH, token1: TOKENS.USDC, fee: 500 }
  ];
  
  for (const pair of pairs) {
    await checkAndAddLiquidity(pair.token0, pair.token1, pair.fee);
  }
  
  console.log("\n✅ Liquidity check complete!");
}

main().catch(console.error);