const hre = require('hardhat');

async function main() {
  const userAddress = '0x5Bd2F329C50860366c0E6D3b4227a422B66AD203';
  const hypeAddress = '0xb82Ca57F6Cc814e945eA999C1B0Ce5ECae156082';
  const usdcAddress = '0xeF2224b2032c05C6C7b48355957F3C67191ac81e';
  
  console.log('=== CHECKING USER TOKEN BALANCES ===');
  console.log('User:', userAddress);
  
  const hypeContract = new hre.ethers.Contract(
    hypeAddress, 
    ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)', 'function symbol() view returns (string)'], 
    hre.ethers.provider
  );
  
  const usdcContract = new hre.ethers.Contract(
    usdcAddress, 
    ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)', 'function symbol() view returns (string)'], 
    hre.ethers.provider
  );
  
  const hypeBalance = await hypeContract.balanceOf(userAddress);
  const usdcBalance = await usdcContract.balanceOf(userAddress);
  const hypeDecimals = await hypeContract.decimals();
  const usdcDecimals = await usdcContract.decimals();
  const hypeSymbol = await hypeContract.symbol();
  const usdcSymbol = await usdcContract.symbol();
  
  console.log('--- Token Balances ---');
  console.log(`${hypeSymbol} balance:`, hre.ethers.formatUnits(hypeBalance, hypeDecimals));
  console.log(`${usdcSymbol} balance:`, hre.ethers.formatUnits(usdcBalance, usdcDecimals));
  
  const ethBalance = await hre.ethers.provider.getBalance(userAddress);
  console.log('ETH balance:', hre.ethers.formatEther(ethBalance));
}

main().catch(console.error);