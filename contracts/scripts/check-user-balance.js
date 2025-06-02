const hre = require('hardhat');

async function main() {
  console.log('=== CHECKING USER HYPERLIQUID SPOT BALANCE ===');
  
  const userAddress = '0x5Bd2F329C50860366c0E6D3b4227a422B66AD203';
  const contractAddress = '0x85a562c72b68a9b9E482B2f44814acB116a37422';
  
  const ABI = ['function getUserSpotBalance(address user, uint64 token) external view returns (uint64)'];
  const contract = new hre.ethers.Contract(contractAddress, ABI, hre.ethers.provider);
  
  console.log('User address:', userAddress);
  console.log('Checking token 0 (HYPE) spot balance...');
  
  try {
    const spotBalance = await contract.getUserSpotBalance(userAddress, 0);
    console.log('User spot balance (token 0):', spotBalance.toString());
    console.log('Required for 0.1 deposit:', '100000000000000000');
    console.log('Has sufficient balance:', spotBalance >= BigInt('100000000000000000'));
    
    const nativeBalance = await hre.ethers.provider.getBalance(userAddress);
    console.log('\nUser native balance:', hre.ethers.formatEther(nativeBalance), 'HYPE');
    
    console.log('\n=== DIAGNOSIS ===');
    if (spotBalance < BigInt('100000000000000000')) {
      console.log('❌ ISSUE: You need Hyperliquid spot balance to make deposits');
      console.log('💡 SOLUTION: Transfer some HYPE to your Hyperliquid spot balance first');
      console.log('📖 Use Hyperliquid UI to transfer from wallet to spot account');
    } else {
      console.log('✅ Sufficient spot balance available');
    }
    
  } catch (error) {
    console.log('Error checking balance:', error.message);
  }
}

main().catch(console.error);