const hre = require('hardhat');

async function main() {
  console.log('=== DEBUGGING FAILED DEPOSIT TRANSACTION ===');
  
  // Use one of the failed transaction hashes from the logs
  const txHash = '0xbbf033ab950976f3ed24c84642842cd9fb10dab194676979ad7d752e9f2eeea8';
  
  console.log('Transaction hash:', txHash);
  
  try {
    // Get transaction details
    const tx = await hre.ethers.provider.getTransaction(txHash);
    console.log('\n--- Transaction Details ---');
    console.log('From:', tx.from);
    console.log('To:', tx.to);
    console.log('Value:', hre.ethers.formatEther(tx.value), 'ETH');
    console.log('Gas Limit:', tx.gasLimit.toString());
    console.log('Gas Price:', tx.gasPrice.toString());
    console.log('Data length:', tx.data.length);
    
    // Get transaction receipt
    const receipt = await hre.ethers.provider.getTransactionReceipt(txHash);
    console.log('\n--- Transaction Receipt ---');
    console.log('Status:', receipt.status === 1 ? 'Success' : 'Failed');
    console.log('Gas Used:', receipt.gasUsed.toString());
    console.log('Block:', receipt.blockNumber);
    
    // Try to decode the revert reason
    if (receipt.status === 0) {
      console.log('\n--- Attempting to get revert reason ---');
      try {
        // Try to call the transaction again to get the revert reason
        const result = await hre.ethers.provider.call({
          to: tx.to,
          data: tx.data,
          value: tx.value,
          from: tx.from
        }, receipt.blockNumber);
        
        console.log('Call result:', result);
      } catch (error) {
        console.log('Revert reason:', error.reason || error.message);
        
        // Check if it's a specific contract error
        if (error.data) {
          console.log('Error data:', error.data);
          
          // Try to decode common error signatures
          const errorSignatures = {
            '0x08c379a0': 'Error(string)', // Standard revert with message
            '0x4e487b71': 'Panic(uint256)' // Panic errors
          };
          
          const errorSig = error.data.slice(0, 10);
          if (errorSignatures[errorSig]) {
            console.log('Error type:', errorSignatures[errorSig]);
            if (errorSig === '0x08c379a0') {
              try {
                const decoded = hre.ethers.AbiCoder.defaultAbiCoder().decode(['string'], '0x' + error.data.slice(10));
                console.log('Decoded error message:', decoded[0]);
              } catch (e) {
                console.log('Could not decode error message');
              }
            }
          }
        }
      }
    }
    
    // Check if contract has bytecode
    const contractCode = await hre.ethers.provider.getCode(tx.to);
    console.log('\n--- Contract Status ---');
    console.log('Contract has code:', contractCode !== '0x');
    console.log('Code length:', contractCode.length);
    
  } catch (error) {
    console.log('Error debugging transaction:', error.message);
  }
}

main().catch(console.error);