const hre = require('hardhat');

async function checkCommitments() {
  const contractAddress = '0xFB6d3B483676C53C9Bf5A4bE22B175F99c0480ff';
  
  console.log('🔍 Checking Commitments in Contract...');
  
  const CONTRACT_ABI = [
    'function commitmentMerkleTree(uint256) view returns (bytes32)',
    'function commitments(bytes32) view returns (bool)',
    'event PrivateDeposit(bytes32 indexed commitment, uint256 timestamp)'
  ];
  
  const provider = hre.ethers.provider;
  const contract = new hre.ethers.Contract(contractAddress, CONTRACT_ABI, provider);
  
  try {
    // Try to read commitments from merkle tree array
    console.log('\n📋 Checking Commitment Merkle Tree...');
    for (let i = 0; i < 5; i++) {
      try {
        const commitment = await contract.commitmentMerkleTree(i);
        console.log(`[${i}]: ${commitment}`);
        
        // Check if this commitment is marked as valid
        const isValid = await contract.commitments(commitment);
        console.log(`  Valid: ${isValid}`);
      } catch (error) {
        if (i === 0) {
          console.log('No commitments found in merkle tree');
        }
        break;
      }
    }
    
    // Get all PrivateDeposit events ever
    console.log('\n📊 Checking ALL Deposit Events...');
    const filter = contract.filters.PrivateDeposit();
    const events = await contract.queryFilter(filter, 0, 'latest');
    
    console.log(`Total deposit events: ${events.length}`);
    
    if (events.length > 0) {
      console.log('\nAll deposits:');
      for (const event of events) {
        const block = await provider.getBlock(event.blockNumber);
        console.log({
          commitment: event.args[0],
          timestamp: new Date(block.timestamp * 1000).toLocaleString(),
          block: event.blockNumber,
          tx: event.transactionHash
        });
      }
    }
    
    // Check a few blocks around the pending deposit time
    console.log('\n🔍 Checking Recent Transactions...');
    const currentBlock = await provider.getBlockNumber();
    const txCount = await provider.getTransactionCount(contractAddress);
    console.log('Contract transaction count:', txCount);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkCommitments().catch(console.error);