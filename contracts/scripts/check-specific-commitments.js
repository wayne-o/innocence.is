const hre = require('hardhat');

async function checkSpecificCommitments() {
  const contractAddress = '0xFB6d3B483676C53C9Bf5A4bE22B175F99c0480ff';
  
  const commitments = [
    {
      commitment: '0xaeb940bc01c9db9b9d133fe65fee31b76b41e1e981385fe85863fcfef1dec213',
      asset: 'HYPE',
      amount: '0.1',
      timestamp: '2025-06-06T08:02:25.393Z'
    },
    {
      commitment: '0xac7c5c2f0ac1167f0f2c000a0ceb629f9a38b188d1fb95068708ec8c9db80eb8',
      asset: 'HYPE',
      amount: '0.1',
      timestamp: '2025-06-06T08:00:08.593Z'
    }
  ];
  
  console.log('🔍 Checking Specific Commitments...\n');
  
  const CONTRACT_ABI = [
    'function commitments(bytes32) view returns (bool)',
    'function commitmentMerkleTree(uint256) view returns (bytes32)',
    'event PrivateDeposit(bytes32 indexed commitment, uint256 timestamp)'
  ];
  
  const provider = hre.ethers.provider;
  const contract = new hre.ethers.Contract(contractAddress, CONTRACT_ABI, provider);
  
  // Check each commitment
  for (const data of commitments) {
    console.log(`📋 Commitment: ${data.commitment}`);
    console.log(`   Asset: ${data.asset}, Amount: ${data.amount}`);
    console.log(`   Timestamp: ${data.timestamp}`);
    
    try {
      // Check if commitment exists
      const exists = await contract.commitments(data.commitment);
      console.log(`   ✅ Stored in contract: ${exists ? 'YES' : 'NO'}`);
      
      // Find position in merkle tree
      let position = -1;
      for (let i = 0; i < 10; i++) {
        try {
          const treeCommitment = await contract.commitmentMerkleTree(i);
          if (treeCommitment.toLowerCase() === data.commitment.toLowerCase()) {
            position = i;
            break;
          }
        } catch (e) {
          break;
        }
      }
      console.log(`   📍 Merkle tree position: ${position >= 0 ? position : 'Not found'}`);
      
      // Check for deposit event
      const filter = contract.filters.PrivateDeposit(data.commitment);
      const events = await contract.queryFilter(filter, 0, 'latest');
      
      if (events.length > 0) {
        const event = events[0];
        const block = await provider.getBlock(event.blockNumber);
        console.log(`   🎯 Deposit event found:`);
        console.log(`      Block: ${event.blockNumber}`);
        console.log(`      Tx: ${event.transactionHash}`);
        console.log(`      Time: ${new Date(block.timestamp * 1000).toLocaleString()}`);
      } else {
        console.log(`   ❌ No deposit event found`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
  }
  
  // Show total deposits
  console.log('📊 Summary:');
  const validCommitments = [];
  for (let i = 0; i < 10; i++) {
    try {
      const commitment = await contract.commitmentMerkleTree(i);
      if (commitment !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        validCommitments.push(commitment);
      }
    } catch (e) {
      break;
    }
  }
  console.log(`Total commitments in merkle tree: ${validCommitments.length}`);
  console.log(`Total HYPE deposited: ${validCommitments.length * 0.1} HYPE`);
}

checkSpecificCommitments().catch(console.error);