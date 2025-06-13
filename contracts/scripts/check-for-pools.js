const { ethers } = require("hardhat");

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.hyperliquid-testnet.xyz/evm');
  
  // Uniswap V3 Factory
  const factoryAddress = '0x373d38df18970470f889b2818C4e10d276fd06eA';
  const factoryABI = [
    'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)'
  ];
  
  const factory = new ethers.Contract(factoryAddress, factoryABI, provider);
  
  // Token addresses
  const testWHYPE = '0x1eBF615D720041AB0E64112d6dbc2ea9A71abEEa';
  const testUSDC = '0xfC2348222447c85779Eebb46782335cdB5B56303';
  
  // Check all fee tiers
  const feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
  
  console.log('=== CHECKING FOR POOLS ===');
  console.log('TestWHYPE:', testWHYPE);
  console.log('TestUSDC:', testUSDC);
  console.log('');
  
  for (const fee of feeTiers) {
    try {
      const poolAddress = await factory.getPool(testWHYPE, testUSDC, fee);
      console.log(`Fee tier ${fee/10000}%: Pool address = ${poolAddress}`);
      
      if (poolAddress !== '0x0000000000000000000000000000000000000000') {
        // Pool exists, check its state
        const poolABI = ['function liquidity() view returns (uint128)'];
        const pool = new ethers.Contract(poolAddress, poolABI, provider);
        try {
          const liquidity = await pool.liquidity();
          console.log(`  Liquidity: ${liquidity.toString()}`);
        } catch (e) {
          console.log('  Error reading liquidity:', e.message);
        }
      }
    } catch (error) {
      console.error(`Error checking fee tier ${fee}: ${error.message}`);
    }
  }
}

main().catch(console.error);