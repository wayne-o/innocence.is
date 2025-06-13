const hre = require("hardhat");

async function main() {
  console.log('Checking Innocence Privacy System Contract State');
  console.log('==============================================');
  
  const PRIVACY_SYSTEM_ADDRESS = '0xbfbC55261c22778686C2B44f596A6dA232Ae0779';
  console.log(`Contract: ${PRIVACY_SYSTEM_ADDRESS}`);
  console.log('');

  // Get contract instance
  const PrivacySystem = await hre.ethers.getContractFactory("HyperliquidPrivacySystemEVM");
  const contract = PrivacySystem.attach(PRIVACY_SYSTEM_ADDRESS);

  try {
    // Check merkle root
    const merkleRoot = await contract.getMerkleRoot();
    console.log(`Merkle Root: ${merkleRoot}`);

    // Check deposit index (number of deposits)
    const depositIndex = await contract.depositIndex();
    console.log(`Total Deposits: ${depositIndex}`);

    // Check contract balance
    const provider = hre.ethers.provider;
    const balance = await provider.getBalance(PRIVACY_SYSTEM_ADDRESS);
    console.log(`Contract HYPE Balance: ${hre.ethers.formatEther(balance)} HYPE`);

    // Get recent deposit events
    console.log('\nRecent Deposits:');
    console.log('---------------');
    
    const filter = contract.filters.Deposit();
    const currentBlock = await provider.getBlockNumber();
    const events = await contract.queryFilter(filter, currentBlock - 10000, currentBlock);
    
    if (events.length === 0) {
      console.log('No recent deposits found in last 10000 blocks');
    } else {
      console.log(`Found ${events.length} deposits`);
      for (const event of events.slice(-5)) { // Show last 5 deposits
        const block = await provider.getBlock(event.blockNumber);
        console.log(`\nDeposit #${event.args.leafIndex}:`);
        console.log(`  Commitment: ${event.args.commitment}`);
        console.log(`  Amount: ${hre.ethers.formatUnits(event.args.amount, 8)} (8 decimals)`);
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

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });