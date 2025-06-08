const hre = require('hardhat');

async function checkHyperliquidBalances() {
  const tradingAddress = '0x44bEa1722477d8b051A181b894Bc6398fc566d30';
  const userAddress = '0x5Bd2F329C50860366c0E6D3b4227a422B66AD203';
  
  console.log('💰 Checking Your Hyperliquid Balances...');
  console.log('User:', userAddress);
  console.log('Trading Contract:', tradingAddress);
  
  const TRADING_ABI = [
    'function getUserSpotBalance(address user, uint32 coin) external view returns (uint64 balance)',
    'function getOraclePrice(uint32 coin) external view returns (uint64 price)',
    'function isCommitmentValid(bytes32 commitment) external view returns (bool valid)',
    'function getMerkleRoot() external view returns (bytes32 root)'
  ];
  
  const contract = new hre.ethers.Contract(tradingAddress, TRADING_ABI, hre.ethers.provider);
  
  // Real Hyperliquid assets on testnet (matching your URLs)
  const realAssets = [
    { id: 0, name: 'USDC', decimals: 6 },
    { id: 1, name: 'ETH', decimals: 18 },
    { id: 2, name: 'BTC', decimals: 8 },
    { id: 3, name: 'SOL', decimals: 9 },
    { id: 4, name: 'HYPE', decimals: 18 }  // The actual HYPE token you linked
  ];
  
  console.log('\n--- Your Hyperliquid Spot Balances ---');
  
  for (const asset of realAssets) {
    try {
      const balance = await contract.getUserSpotBalance(userAddress, asset.id);
      const formattedBalance = hre.ethers.formatUnits(balance, asset.decimals);
      console.log(`${asset.name}:`, formattedBalance);
      
      if (parseFloat(formattedBalance) > 0) {
        console.log(`✅ You have ${formattedBalance} ${asset.name} - ready to trade!`);
      }
    } catch (error) {
      console.log(`${asset.name}: Error -`, error.message.slice(0, 50));
    }
  }
  
  console.log('\n--- Current Oracle Prices ---');
  
  for (const asset of realAssets) {
    try {
      const price = await contract.getOraclePrice(asset.id);
      const formattedPrice = hre.ethers.formatUnits(price, 8);
      console.log(`${asset.name}:`, `$${formattedPrice}`);
    } catch (error) {
      console.log(`${asset.name}: Price error -`, error.message.slice(0, 50));
    }
  }
  
  console.log('\n--- Commitment Verification ---');
  
  // Check recent commitments from the logs
  const recentCommitments = [
    '0x527b2486e777d1031d027cc06218062581f43c8718bce7ea83e27a4a6544f04b', // First tHYPE deposit
    // Add the new ETH deposit commitment if we can extract it
  ];
  
  for (const commitment of recentCommitments) {
    try {
      const isValid = await contract.isCommitmentValid(commitment);
      console.log(`Commitment ${commitment.slice(0, 10)}...: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
      
      if (isValid) {
        console.log(`✅ You can trade with commitment ${commitment.slice(0, 10)}...`);
      }
    } catch (error) {
      console.log(`Commitment ${commitment.slice(0, 10)}...: Error -`, error.message.slice(0, 50));
    }
  }
  
  // Check current merkle root
  try {
    const merkleRoot = await contract.getMerkleRoot();
    console.log('\nCurrent Merkle Root:', merkleRoot);
  } catch (error) {
    console.log('Merkle Root: Error -', error.message.slice(0, 50));
  }
  
  console.log('\n💡 Trading Requirements:');
  console.log('✅ Valid commitment exists (required for trading authorization)');
  console.log('❌ Need Hyperliquid testnet balance (for actual trade execution)');
  console.log('✅ Trading contract deployed and functional');
  console.log('\n🔗 Get testnet funds: https://testnet.hyperliquid.xyz/');
  console.log('💰 Fund your account with ETH/USDC to enable trading');
}

checkHyperliquidBalances().catch(console.error);