const hre = require('hardhat');

async function main() {
  const txHash = '0xb89903cf8ebc68ada0ca0cf5dbcffb892ec7d07162c8f39b32ffd8832df34947';
  
  console.log('=== ANALYZING TRANSACTION DATA ===');
  console.log('TX Hash:', txHash);
  
  try {
    // Get full transaction
    const tx = await hre.ethers.provider.getTransaction(txHash);
    console.log('\n--- Transaction Data ---');
    console.log('To:', tx.to);
    console.log('Value:', hre.ethers.formatEther(tx.value || 0), 'ETH');
    console.log('Data:', tx.data);
    console.log('Gas Limit:', tx.gasLimit.toString());
    
    // Decode the function call
    const iface = new hre.ethers.Interface([
      'function prepareDeposit(uint64 token, uint256 amount) external'
    ]);
    
    try {
      const decoded = iface.parseTransaction({ data: tx.data });
      console.log('\n--- Decoded Function Call ---');
      console.log('Function:', decoded.name);
      console.log('Args:', decoded.args);
      console.log('Token:', decoded.args[0].toString());
      console.log('Amount:', decoded.args[1].toString());
      console.log('Amount in ETH:', hre.ethers.formatEther(decoded.args[1]));
    } catch (decodeError) {
      console.log('\n--- Decode Error ---');
      console.log('Could not decode function call:', decodeError.message);
    }
    
    // Check if there were any reverts
    const receipt = await hre.ethers.provider.getTransactionReceipt(txHash);
    console.log('\n--- Receipt Analysis ---');
    console.log('Status:', receipt.status === 1 ? 'SUCCESS' : 'FAILED');
    console.log('Gas Used:', receipt.gasUsed.toString());
    console.log('Effective Gas Price:', receipt.gasPrice?.toString() || 'N/A');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main().catch(console.error);