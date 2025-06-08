const hre = require('hardhat');

async function checkDepositSuccess() {
  const contractAddress = '0xFB6d3B483676C53C9Bf5A4bE22B175F99c0480ff'; // Privacy contract
  const userAddress = '0x5Bd2F329C50860366c0E6D3b4227a422B66AD203';
  
  console.log('🔍 Checking Deposit Status...');
  console.log('Contract:', contractAddress);
  console.log('User:', userAddress);
  console.log('Network:', hre.network.name);
  
  const CONTRACT_ABI = [
    'function commitments(bytes32) view returns (bool)',
    'function nullifiers(bytes32) view returns (bool)',
    'function getMerkleRoot() view returns (bytes32)',
    'function owner() view returns (address)',
    'event PrivateDeposit(bytes32 indexed commitment, uint256 timestamp)',
    'function pendingDeposits(address) view returns (uint64 token, uint256 amount, uint256 contractBalanceBefore, uint256 timestamp, bool completed)'
  ];
  
  const provider = hre.ethers.provider;
  const contract = new hre.ethers.Contract(contractAddress, CONTRACT_ABI, provider);
  
  try {
    // Check pending deposits
    console.log('\n📋 Checking Pending Deposits...');
    const pending = await contract.pendingDeposits(userAddress);
    console.log('Pending deposit:', {
      token: pending.token.toString(),
      amount: hre.ethers.formatEther(pending.amount),
      timestamp: new Date(Number(pending.timestamp) * 1000).toLocaleString(),
      completed: pending.completed
    });
    
    // Check recent deposit events
    console.log('\n📊 Checking Recent Deposit Events...');
    const filter = contract.filters.PrivateDeposit();
    const currentBlock = await provider.getBlockNumber();
    const events = await contract.queryFilter(filter, currentBlock - 1000, currentBlock);
    
    console.log(`Found ${events.length} deposit events in last 1000 blocks`);
    
    if (events.length > 0) {
      console.log('\nRecent deposits:');
      for (const event of events.slice(-5)) { // Show last 5
        const block = await provider.getBlock(event.blockNumber);
        console.log({
          commitment: event.args[0],
          timestamp: new Date(block.timestamp * 1000).toLocaleString(),
          block: event.blockNumber,
          tx: event.transactionHash
        });
      }
    }
    
    // Check merkle root
    const merkleRoot = await contract.getMerkleRoot();
    console.log('\n🌳 Current Merkle Root:', merkleRoot);
    
    // If you have a specific commitment to check
    const commitmentToCheck = process.env.COMMITMENT;
    if (commitmentToCheck) {
      const exists = await contract.commitments(commitmentToCheck);
      console.log(`\n✅ Commitment ${commitmentToCheck} exists:`, exists);
    }
    
  } catch (error) {
    console.error('Error checking deposit:', error.message);
  }
}

checkDepositSuccess().catch(console.error);