const hre = require('hardhat');

async function main() {
  const contractAddress = '0xFB6d3B483676C53C9Bf5A4bE22B175F99c0480ff';
  const completionTx = '0xc24ad93486bb73a3946d29461cd266dc6d562a9438d7a3a8fa21b7837d78ab88';
  
  console.log('=== VERIFYING TESTNET DEPOSIT COMMITMENT ===');
  console.log('Contract:', contractAddress);
  console.log('Completion TX:', completionTx);
  
  const ABI = [
    'function commitments(bytes32) external view returns (bool)',
    'function getMerkleRoot() external view returns (bytes32)',
    'event PrivateDeposit(bytes32 indexed commitment, uint256 timestamp)',
    'function pendingDeposits(address) external view returns (uint64 token, uint256 amount, uint256 contractBalanceBefore, uint256 timestamp, bool completed)'
  ];
  
  const contract = new hre.ethers.Contract(contractAddress, ABI, hre.ethers.provider);
  
  try {
    // Get transaction receipt to extract commitment from logs
    const receipt = await hre.ethers.provider.getTransactionReceipt(completionTx);
    console.log('\n--- Transaction Analysis ---');
    console.log('Status:', receipt.status === 1 ? 'SUCCESS ✅' : 'FAILED ❌');
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
        console.log('✅ SUCCESS: tHYPE deposit commitment verified and stored on-chain!');
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
    
    // Check contract token balances
    const tokenContract = new hre.ethers.Contract(
      '0xb82Ca57F6Cc814e945eA999C1B0Ce5ECae156082',
      ['function balanceOf(address) view returns (uint256)', 'function symbol() view returns (string)'],
      hre.ethers.provider
    );
    
    const contractTokenBalance = await tokenContract.balanceOf(contractAddress);
    const tokenSymbol = await tokenContract.symbol();
    console.log(`Contract ${tokenSymbol} Balance:`, hre.ethers.formatEther(contractTokenBalance), tokenSymbol);
    
    // Check user's remaining balance
    const userAddress = '0x5Bd2F329C50860366c0E6D3b4227a422B66AD203';
    const userTokenBalance = await tokenContract.balanceOf(userAddress);
    console.log(`User ${tokenSymbol} Balance:`, hre.ethers.formatEther(userTokenBalance), tokenSymbol);
    
    // Check pending deposit status
    const pending = await contract.pendingDeposits(userAddress);
    console.log('\n--- Pending Deposit Status ---');
    console.log('Token ID:', pending[0].toString());
    console.log('Amount:', hre.ethers.formatUnits(pending[1], 18));
    console.log('Completed:', pending[4]);
    
  } catch (error) {
    console.error('Error verifying commitment:', error.message);
  }
}

main().catch(console.error);