const hre = require('hardhat');

async function main() {
  const contractAddress = '0x20d68Ad4Cd0474028dB80917017b1282b7EcfEe2';
  const completionTx = '0x717fdb8410bccb97f35f8e01d64d525bc9b878b00a9ec65baffe5c83af2b5c0a';
  
  console.log('=== VERIFYING COMMITMENT STORAGE ===');
  console.log('Contract:', contractAddress);
  console.log('Completion TX:', completionTx);
  
  const ABI = [
    'function commitments(bytes32) external view returns (bool)',
    'function getMerkleRoot() external view returns (bytes32)',
    'event PrivateDeposit(bytes32 indexed commitment, uint256 timestamp)'
  ];
  
  const contract = new hre.ethers.Contract(contractAddress, ABI, hre.ethers.provider);
  
  try {
    // Get transaction receipt to extract commitment from logs
    const receipt = await hre.ethers.provider.getTransactionReceipt(completionTx);
    console.log('\n--- Transaction Analysis ---');
    console.log('Status:', receipt.status === 1 ? 'SUCCESS' : 'FAILED');
    console.log('Gas Used:', receipt.gasUsed.toString());
    console.log('Number of logs:', receipt.logs.length);
    
    // Parse logs to find PrivateDeposit event
    const iface = new hre.ethers.Interface(ABI);
    let commitment = null;
    
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed.name === 'PrivateDeposit') {
          commitment = parsed.args.commitment;
          console.log('\n--- PrivateDeposit Event Found ---');
          console.log('Commitment:', commitment);
          console.log('Timestamp:', parsed.args.timestamp.toString());
          break;
        }
      } catch (parseError) {
        // Skip logs that don't match our interface
      }
    }
    
    if (commitment) {
      // Verify commitment is stored in contract
      const isStored = await contract.commitments(commitment);
      console.log('\n--- Commitment Verification ---');
      console.log('Commitment stored on-chain:', isStored);
      
      if (isStored) {
        console.log('✅ SUCCESS: Commitment is verified and stored on-chain!');
      } else {
        console.log('❌ ERROR: Commitment not found in contract storage');
      }
    } else {
      console.log('❌ ERROR: No PrivateDeposit event found in transaction logs');
    }
    
    // Check current merkle root
    const merkleRoot = await contract.getMerkleRoot();
    console.log('\n--- Contract State ---');
    console.log('Current Merkle Root:', merkleRoot);
    
    // Check contract ETH balance
    const balance = await hre.ethers.provider.getBalance(contractAddress);
    console.log('Contract ETH Balance:', hre.ethers.formatEther(balance), 'ETH');
    
  } catch (error) {
    console.error('Error verifying commitment:', error.message);
  }
}

main().catch(console.error);