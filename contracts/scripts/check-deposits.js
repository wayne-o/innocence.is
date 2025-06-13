const hre = require("hardhat");

async function main() {
  console.log('\n🔍 Checking Innocence Privacy System');
  console.log('=====================================');
  
  const PRIVACY_SYSTEM_ADDRESS = '0xbfbC55261c22778686C2B44f596A6dA232Ae0779';
  const provider = hre.ethers.provider;
  
  // Get contract balance
  const balance = await provider.getBalance(PRIVACY_SYSTEM_ADDRESS);
  console.log(`\n💰 Contract Balance: ${hre.ethers.formatEther(balance)} HYPE`);
  
  // Get merkle tree state
  const PrivacySystem = await hre.ethers.getContractFactory("HyperliquidPrivacySystemEVM");
  const contract = PrivacySystem.attach(PRIVACY_SYSTEM_ADDRESS);
  
  try {
    const merkleRoot = await contract.getMerkleRoot();
    console.log(`\n🌳 Merkle Root: ${merkleRoot}`);
    
    // Count commitments in merkle tree
    const treeLength = await contract.getCommitmentCount();
    console.log(`📊 Total Commitments: ${treeLength}`);
  } catch (e) {
    console.log(`\n📊 Checking commitment events...`);
    
    // Look for PrivateDeposit events
    const filter = contract.filters.PrivateDeposit();
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 500; // Smaller range to avoid provider limits
    
    console.log(`Searching blocks ${fromBlock} to ${currentBlock}...`);
    const events = await contract.queryFilter(filter, fromBlock, currentBlock);
    
    console.log(`\n💎 Found ${events.length} deposits`);
    
    if (events.length > 0) {
      console.log('\nRecent Deposits:');
      for (const event of events.slice(-5)) {
        const block = await provider.getBlock(event.blockNumber);
        console.log(`\n  🔹 Commitment: ${event.args.commitment}`);
        console.log(`     Block: ${event.blockNumber}`);
        console.log(`     Time: ${new Date(block.timestamp * 1000).toLocaleString()}`);
        console.log(`     Tx: ${event.transactionHash}`);
      }
    }
  }
  
  console.log('\n✅ Ready for your deposit!\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });