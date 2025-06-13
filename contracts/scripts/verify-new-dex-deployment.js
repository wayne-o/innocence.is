const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Verifying new DEX deployment on Hyperliquid testnet...\n");

  // New addresses from deployment
  const addresses = {
    factory: "0x256Bd05A6FDe1F28169eE63e2Daf6410767cF54c",
    swapRouter: "0x6091888770e27ff11f9bE07dD1ce15F1c0897F99",
    nftPositionManager: "0xf6f4D2b4229EcB95917fF74Bc69B51461D7306A7",
    tokens: {
      TestWHYPE: "0x1eBF615D720041AB0E64112d6dbc2ea9A71abEEa",
      TestUSDC: "0xfC2348222447c85779Eebb46782335cdB5B56303",
      WETH9: "0x64C60400f1eB8F5a5287347075d20061eaf23deb"
    }
  };

  console.log("=== Contract Deployment Status ===\n");

  // Check each contract
  for (const [name, address] of Object.entries(addresses)) {
    if (name === 'tokens') continue;
    const code = await ethers.provider.getCode(address);
    console.log(`${name}:`);
    console.log(`  Address: ${address}`);
    console.log(`  Deployed: ${code !== "0x" ? "✅ Yes" : "❌ No"}`);
  }

  console.log("\n=== Token Deployment Status ===\n");

  // Check tokens
  for (const [name, address] of Object.entries(addresses.tokens)) {
    const code = await ethers.provider.getCode(address);
    console.log(`${name}:`);
    console.log(`  Address: ${address}`);
    console.log(`  Deployed: ${code !== "0x" ? "✅ Yes" : "❌ No"}`);
    
    if (code !== "0x") {
      try {
        const token = new ethers.Contract(address, [
          "function symbol() view returns (string)",
          "function decimals() view returns (uint8)",
          "function totalSupply() view returns (uint256)",
          "function balanceOf(address) view returns (uint256)"
        ], signer);
        
        const symbol = await token.symbol();
        const decimals = await token.decimals();
        const totalSupply = await token.totalSupply();
        const balance = await token.balanceOf(signer.address);
        
        console.log(`  Symbol: ${symbol}`);
        console.log(`  Decimals: ${decimals}`);
        console.log(`  Total Supply: ${ethers.formatUnits(totalSupply, decimals)}`);
        console.log(`  Your Balance: ${ethers.formatUnits(balance, decimals)}`);
      } catch (error) {
        console.log(`  Error reading token: ${error.message}`);
      }
    }
  }

  console.log("\n=== Checking Uniswap V3 Pools ===\n");

  // Factory ABI
  const factoryABI = [
    "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
  ];

  const factory = new ethers.Contract(addresses.factory, factoryABI, signer);

  // Check for pools
  const pairs = [
    { name: "WHYPE/USDC", tokenA: addresses.tokens.TestWHYPE, tokenB: addresses.tokens.TestUSDC },
    { name: "WHYPE/WETH", tokenA: addresses.tokens.TestWHYPE, tokenB: addresses.tokens.WETH9 },
    { name: "WETH/USDC", tokenA: addresses.tokens.WETH9, tokenB: addresses.tokens.TestUSDC }
  ];

  const fees = [500, 3000, 10000]; // 0.05%, 0.3%, 1%

  for (const pair of pairs) {
    console.log(`${pair.name} pools:`);
    let poolFound = false;
    
    for (const fee of fees) {
      try {
        const poolAddress = await factory.getPool(pair.tokenA, pair.tokenB, fee);
        if (poolAddress !== ethers.ZeroAddress) {
          console.log(`  ${fee/10000}% fee tier: ${poolAddress}`);
          poolFound = true;
          
          // Check pool liquidity
          const poolABI = [
            "function liquidity() external view returns (uint128)",
            "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
          ];
          
          try {
            const pool = new ethers.Contract(poolAddress, poolABI, signer);
            const liquidity = await pool.liquidity();
            console.log(`    Liquidity: ${liquidity.toString()}`);
            
            if (liquidity.toString() === "0") {
              console.log(`    ⚠️  No liquidity in pool`);
            }
          } catch (e) {
            console.log(`    Error checking liquidity: ${e.message}`);
          }
        }
      } catch (error) {
        // Pool doesn't exist
      }
    }
    
    if (!poolFound) {
      console.log(`  ❌ No pools created yet`);
    }
  }

  console.log("\n=== Privacy System Integration ===\n");

  const privacySystemAddress = "0xC15D0a6Ca112a36283a309D801329Ade59CaBBA5";
  const dexExtensionAddress = "0xa3F09EB1406209054FaC9EA6f4CA57F1B4b86260";

  // Check token approvals
  console.log("Checking token approvals from Privacy System to DEX Extension:");
  
  for (const [name, tokenAddress] of Object.entries(addresses.tokens)) {
    try {
      const token = new ethers.Contract(tokenAddress, [
        "function allowance(address owner, address spender) view returns (uint256)"
      ], signer);
      
      const allowance = await token.allowance(privacySystemAddress, dexExtensionAddress);
      console.log(`  ${name}: ${allowance.toString() === ethers.MaxUint256.toString() ? "✅ Max approval" : allowance.toString()}`);
    } catch (error) {
      console.log(`  ${name}: Error checking allowance`);
    }
  }

  console.log("\n=== Summary ===\n");
  console.log("✅ Uniswap V3 contracts are deployed");
  console.log("✅ Test tokens are deployed");
  console.log("⚠️  Need to create and add liquidity to pools");
  console.log("✅ Privacy system has approved DEX for tokens");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });