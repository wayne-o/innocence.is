const { ethers } = require('ethers');

// Contract configuration
const PRIVACY_SYSTEM_ADDRESS = '0xbfbC55261c22778686C2B44f596A6dA232Ae0779';
const RPC_URL = 'https://rpc.hyperliquid-testnet.xyz/evm';

// ABI for the functions we need to check
const ABI = [
  'function getMerkleRoot() view returns (bytes32)',
  'function commitments(bytes32) view returns (bool)',
  'function nullifiers(bytes32) view returns (bool)',
  'function depositIndex() view returns (uint32)',
  'function getBalance(address token) view returns (uint256)',
  'event Deposit(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp, uint256 amount, uint64 indexed token)'
];

async function checkContractState() {
  console.log('Checking Innocence Privacy System Contract State');
  console.log('==============================================');
  console.log(`Contract: ${PRIVACY_SYSTEM_ADDRESS}`);
  console.log('');

  // Connect to provider
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(PRIVACY_SYSTEM_ADDRESS, ABI, provider);

  try {
    // Check merkle root
    const merkleRoot = await contract.getMerkleRoot();
    console.log(`Merkle Root: ${merkleRoot}`);

    // Check deposit index (number of deposits)
    const depositIndex = await contract.depositIndex();
    console.log(`Total Deposits: ${depositIndex}`);

    // Check contract balance for token 0 (HYPE)
    const hypeBalance = await contract.getBalance('0x0000000000000000000000000000000000000000');
    console.log(`HYPE Balance: ${ethers.formatEther(hypeBalance)} HYPE`);

    // Get recent deposit events
    console.log('\nRecent Deposits:');
    console.log('---------------');
    
    const currentBlock = await provider.getBlockNumber();
    const filter = contract.filters.Deposit();
    const events = await contract.queryFilter(filter, currentBlock - 1000, currentBlock);
    
    if (events.length === 0) {
      console.log('No recent deposits found');
    } else {
      for (const event of events.slice(-5)) { // Show last 5 deposits
        const block = await provider.getBlock(event.blockNumber);
        console.log(`\nDeposit #${event.args.leafIndex}:`);
        console.log(`  Commitment: ${event.args.commitment}`);
        console.log(`  Amount: ${ethers.formatUnits(event.args.amount, 8)} (8 decimals)`);
        console.log(`  Token ID: ${event.args.token}`);
        console.log(`  Time: ${new Date(block.timestamp * 1000).toLocaleString()}`);
        console.log(`  Block: ${event.blockNumber}`);
        console.log(`  Tx: ${event.transactionHash}`);
      }
    }

  } catch (error) {
    console.error('Error checking contract state:', error.message);
  }
}

// Run the check
checkContractState().then(() => {
  console.log('\nDone checking contract state');
}).catch(console.error);