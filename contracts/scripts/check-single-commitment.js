const hre = require('hardhat');

async function checkSingleCommitment() {
  const contractAddress = '0xFB6d3B483676C53C9Bf5A4bE22B175F99c0480ff';
  const commitmentToCheck = '0x0120b17e366f9c338b22ac45ce6dbc4b0c4f9228629a8b8f2411cc21b075607b';
  
  console.log('🔍 Checking Commitment:', commitmentToCheck);
  console.log('Contract:', contractAddress);
  console.log('');
  
  const CONTRACT_ABI = [
    'function commitments(bytes32) view returns (bool)',
    'function commitmentMerkleTree(uint256) view returns (bytes32)',
    'function getMerkleRoot() view returns (bytes32)',
    'event PrivateDeposit(bytes32 indexed commitment, uint256 timestamp)'
  ];
  
  const provider = hre.ethers.provider;
  const contract = new hre.ethers.Contract(contractAddress, CONTRACT_ABI, provider);
  
  try {
    // Check if commitment exists
    const exists = await contract.commitments(commitmentToCheck);
    console.log('✅ Stored in contract:', exists ? 'YES' : 'NO');
    
    if (!exists) {
      console.log('\n❌ This commitment is NOT stored in the contract');
      console.log('   Possible reasons:');
      console.log('   - Deposit not completed');
      console.log('   - Different contract address');
      console.log('   - Transaction failed');
      
      // Check all commitments to help debug
      console.log('\n📋 Current commitments in merkle tree:');
      for (let i = 0; i < 10; i++) {
        try {
          const commitment = await contract.commitmentMerkleTree(i);
          if (commitment !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
            console.log(`[${i}]: ${commitment}`);
          }
        } catch (e) {
          break;
        }
      }
    } else {
      // Find position in merkle tree
      let position = -1;
      for (let i = 0; i < 20; i++) {
        try {
          const treeCommitment = await contract.commitmentMerkleTree(i);
          if (treeCommitment.toLowerCase() === commitmentToCheck.toLowerCase()) {
            position = i;
            break;
          }
        } catch (e) {
          break;
        }
      }
      console.log('📍 Merkle tree position:', position >= 0 ? position : 'Not found');
      
      // Get merkle root
      const merkleRoot = await contract.getMerkleRoot();
      console.log('🌳 Current Merkle Root:', merkleRoot);
      
      // Try to find deposit event
      const currentBlock = await provider.getBlockNumber();
      console.log('\n🔍 Searching for deposit event...');
      
      // Search in chunks to avoid range limit
      const chunkSize = 500;
      let eventFound = false;
      
      for (let start = currentBlock - 2000; start < currentBlock; start += chunkSize) {
        try {
          const end = Math.min(start + chunkSize - 1, currentBlock);
          const filter = contract.filters.PrivateDeposit(commitmentToCheck);
          const events = await contract.queryFilter(filter, start, end);
          
          if (events.length > 0) {
            const event = events[0];
            const block = await provider.getBlock(event.blockNumber);
            console.log('🎯 Deposit event found!');
            console.log('   Block:', event.blockNumber);
            console.log('   Tx:', event.transactionHash);
            console.log('   Time:', new Date(block.timestamp * 1000).toLocaleString());
            eventFound = true;
            break;
          }
        } catch (e) {
          // Continue searching
        }
      }
      
      if (!eventFound) {
        console.log('⚠️  No deposit event found (searched last 2000 blocks)');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSingleCommitment().catch(console.error);