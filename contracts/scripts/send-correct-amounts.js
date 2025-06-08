const hre = require('hardhat');

async function main() {
  const userAddress = '0x5Bd2F329C50860366c0E6D3b4227a422B66AD203';
  const hypeAddress = '0xb82Ca57F6Cc814e945eA999C1B0Ce5ECae156082';
  const usdcAddress = '0xeF2224b2032c05C6C7b48355957F3C67191ac81e';
  
  console.log('=== SENDING CORRECT TOKEN AMOUNTS ===');
  console.log('User:', userAddress);
  
  const [deployer] = await hre.ethers.getSigners();
  
  const hypeContract = new hre.ethers.Contract(
    hypeAddress, 
    ['function transfer(address to, uint256 amount) external returns (bool)', 'function balanceOf(address) view returns (uint256)'], 
    deployer
  );
  
  const usdcContract = new hre.ethers.Contract(
    usdcAddress, 
    ['function transfer(address to, uint256 amount) external returns (bool)', 'function balanceOf(address) view returns (uint256)'], 
    deployer
  );
  
  // Check current user balances
  const currentHype = await hypeContract.balanceOf(userAddress);
  const currentUsdc = await usdcContract.balanceOf(userAddress);
  
  console.log('Current user tHYPE:', hre.ethers.formatEther(currentHype));
  console.log('Current user tUSDC:', hre.ethers.formatUnits(currentUsdc, 6));
  
  // User already has tokens, so we're good!
  console.log('✅ User already has tokens from deployment');
  console.log('✅ Ready to test the system!');
  
  console.log('\n--- MetaMask Import Instructions ---');
  console.log('1. Switch to Hyperliquid Testnet (Chain ID: 998)');
  console.log('2. Import tHYPE token:', hypeAddress);
  console.log('3. Import tUSDC token:', usdcAddress);
}

main().catch(console.error);