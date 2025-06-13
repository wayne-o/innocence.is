const { ethers } = require("hardhat");

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.hyperliquid-testnet.xyz/evm');
  
  // Pool addresses from deployment
  const pools = [
    {
      name: "TestWHYPE/TestUSDC",
      address: "0xe28f91cb03a3a73d68d8a690e292f93eba81fd62",
      token0: "0x1eBF615D720041AB0E64112d6dbc2ea9A71abEEa", // TestWHYPE
      token1: "0xfC2348222447c85779Eebb46782335cdB5B56303", // TestUSDC
    }
  ];
  
  const poolABI = [
    'function token0() view returns (address)',
    'function token1() view returns (address)',
    'function fee() view returns (uint24)',
    'function liquidity() view returns (uint128)',
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'
  ];
  
  const tokenABI = [
    'function balanceOf(address) view returns (uint256)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)'
  ];
  
  console.log('=== CHECKING POOL STATE ===\n');
  
  for (const poolInfo of pools) {
    console.log(`Pool: ${poolInfo.name}`);
    console.log(`Address: ${poolInfo.address}`);
    
    try {
      const pool = new ethers.Contract(poolInfo.address, poolABI, provider);
      
      // Get pool liquidity
      const liquidity = await pool.liquidity();
      console.log(`Liquidity: ${liquidity.toString()}`);
      
      // Get slot0 for price info
      const slot0 = await pool.slot0();
      console.log(`sqrtPriceX96: ${slot0.sqrtPriceX96.toString()}`);
      console.log(`Current tick: ${slot0.tick}`);
      
      // Calculate price from sqrtPriceX96
      const sqrtPriceX96 = slot0.sqrtPriceX96;
      const price = (Number(sqrtPriceX96) / (2 ** 96)) ** 2;
      console.log(`Price (token1/token0): ${price}`);
      
      // With decimals adjustment (USDC has 6, WHYPE has 18)
      const adjustedPrice = price * (10 ** 12); // 10^(18-6)
      console.log(`Adjusted price (USDC per WHYPE): ${adjustedPrice}`);
      
      // Check token balances in pool
      const token0 = new ethers.Contract(poolInfo.token0, tokenABI, provider);
      const token1 = new ethers.Contract(poolInfo.token1, tokenABI, provider);
      
      const balance0 = await token0.balanceOf(poolInfo.address);
      const balance1 = await token1.balanceOf(poolInfo.address);
      
      console.log(`\nPool token balances:`);
      console.log(`TestWHYPE: ${ethers.formatEther(balance0)}`);
      console.log(`TestUSDC: ${ethers.formatUnits(balance1, 6)}`);
      
    } catch (error) {
      console.error(`Error checking pool: ${error.message}`);
    }
    
    console.log('\n---\n');
  }
}

main().catch(console.error);