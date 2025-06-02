const hre = require('hardhat');

async function main() {
  const txHash = '0xb89903cf8ebc68ada0ca0cf5dbcffb892ec7d07162c8f39b32ffd8832df34947';
  
  console.log('=== CHECKING PREPARE DEPOSIT TRANSACTION ===');
  console.log('TX Hash:', txHash);
  
  try {
    const receipt = await hre.ethers.provider.getTransactionReceipt(txHash);
    console.log('\n--- Transaction Receipt ---');
    console.log('Status:', receipt.status === 1 ? 'SUCCESS' : 'FAILED');
    console.log('Gas Used:', receipt.gasUsed.toString());
    console.log('Logs:', receipt.logs.length);
    
    if (receipt.logs.length > 0) {
      console.log('\n--- Logs ---');
      receipt.logs.forEach((log, i) => {
        console.log(`Log ${i}:`, log);
      });
    }
    
    // Now check current pending deposits
    const contractAddress = '0x20d68Ad4Cd0474028dB80917017b1282b7EcfEe2';
    const userAddress = '0x5Bd2F329C50860366c0E6D3b4227a422B66AD203';
    
    const ABI = ['function pendingDeposits(address) external view returns (uint64 token, uint256 amount, uint256 contractBalanceBefore, uint256 timestamp, bool completed)'];
    const contract = new hre.ethers.Contract(contractAddress, ABI, hre.ethers.provider);
    
    const pending = await contract.pendingDeposits(userAddress);
    console.log('\n--- Current Pending Deposit ---');
    console.log('Token:', pending[0].toString());
    console.log('Amount:', pending[1].toString());
    console.log('Balance Before:', pending[2].toString());
    console.log('Timestamp:', pending[3].toString());
    console.log('Completed:', pending[4]);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main().catch(console.error);