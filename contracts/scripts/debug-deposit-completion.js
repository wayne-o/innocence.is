const hre = require('hardhat');

async function main() {
  const contractAddress = '0x20d68Ad4Cd0474028dB80917017b1282b7EcfEe2';
  const userAddress = '0x5Bd2F329C50860366c0E6D3b4227a422B66AD203';
  
  const ABI = [
    'function canCompleteDeposit(address user) external view returns (bool)',
    'function pendingDeposits(address) external view returns (uint64 token, uint64 amount, uint64 contractBalanceBefore, uint256 timestamp, bool completed)'
  ];
  
  const contract = new hre.ethers.Contract(contractAddress, ABI, hre.ethers.provider);
  
  console.log('=== DEBUGGING COMPLETION STATUS ===');
  console.log('User:', userAddress);
  console.log('Contract:', contractAddress);
  
  try {
    // Check pending deposit
    const pending = await contract.pendingDeposits(userAddress);
    console.log('\n--- Pending Deposit Info ---');
    console.log('Token:', pending[0].toString());
    console.log('Amount:', pending[1].toString());
    console.log('Contract Balance Before:', pending[2].toString());
    console.log('Timestamp:', pending[3].toString());
    console.log('Completed:', pending[4]);
    
    // Check if can complete
    const canComplete = await contract.canCompleteDeposit(userAddress);
    console.log('\n--- Completion Status ---');
    console.log('Can complete deposit:', canComplete);
    
    // Check contract ETH balance
    const balance = await hre.ethers.provider.getBalance(contractAddress);
    console.log('\n--- Contract Balance ---');
    console.log('Contract ETH balance:', hre.ethers.formatEther(balance), 'ETH');
    
    // Calculate expected balance
    const expectedBalance = BigInt(pending[2]) + BigInt(pending[1]);
    console.log('Expected balance:', hre.ethers.formatEther(expectedBalance), 'ETH');
    console.log('Actual balance:', hre.ethers.formatEther(balance), 'ETH');
    console.log('Balance increase:', hre.ethers.formatEther(BigInt(balance) - BigInt(pending[2])), 'ETH');
    console.log('Required increase:', hre.ethers.formatEther(pending[1]), 'ETH');
    
  } catch (error) {
    console.error('Error checking deposit status:', error.message);
  }
}

main().catch(console.error);