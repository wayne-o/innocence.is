const hre = require('hardhat');

async function checkContractBalance() {
  const contractAddress = '0xFB6d3B483676C53C9Bf5A4bE22B175F99c0480ff';
  const tUSDCAddress = '0xeF2224b2032c05C6C7b48355957F3C67191ac81e';
  
  console.log('💰 Checking Contract Balances...');
  console.log('Privacy Contract:', contractAddress);
  
  const provider = hre.ethers.provider;
  
  // Check native HYPE balance
  const hypeBalance = await provider.getBalance(contractAddress);
  console.log('\nNative HYPE Balance:', hre.ethers.formatEther(hypeBalance), 'HYPE');
  
  // Check tUSDC balance
  const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)'
  ];
  
  const usdcContract = new hre.ethers.Contract(tUSDCAddress, ERC20_ABI, provider);
  
  try {
    const usdcBalance = await usdcContract.balanceOf(contractAddress);
    const decimals = await usdcContract.decimals();
    const symbol = await usdcContract.symbol();
    
    console.log(`\n${symbol} Balance:`, hre.ethers.formatUnits(usdcBalance, decimals), symbol);
    console.log('Raw balance:', usdcBalance.toString());
  } catch (error) {
    console.log('\ntUSDC Balance: Error reading -', error.message);
  }
  
  // Check if contract has any code
  const code = await provider.getCode(contractAddress);
  console.log('\nContract has code:', code.length > 2 ? 'Yes' : 'No');
  
  // Get latest block info
  const block = await provider.getBlock('latest');
  console.log('\nLatest block:', block.number);
  console.log('Timestamp:', new Date(block.timestamp * 1000).toLocaleString());
}

checkContractBalance().catch(console.error);