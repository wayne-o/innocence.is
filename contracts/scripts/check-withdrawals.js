const hre = require("hardhat");

async function main() {
  console.log('\n🔍 Checking Withdrawals');
  console.log('======================');
  
  const PRIVACY_SYSTEM_ADDRESS = '0xbfbC55261c22778686C2B44f596A6dA232Ae0779';
  const provider = hre.ethers.provider;
  
  const PrivacySystem = await hre.ethers.getContractFactory("HyperliquidPrivacySystemEVM");
  const contract = PrivacySystem.attach(PRIVACY_SYSTEM_ADDRESS);
  
  // Look for PrivateWithdraw events
  const filter = contract.filters.PrivateWithdraw();
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = currentBlock - 500;
  
  console.log(`Searching blocks ${fromBlock} to ${currentBlock}...`);
  const events = await contract.queryFilter(filter, fromBlock, currentBlock);
  
  console.log(`\n💸 Found ${events.length} withdrawals`);
  
  if (events.length > 0) {
    console.log('\nRecent Withdrawals:');
    for (const event of events) {
      const block = await provider.getBlock(event.blockNumber);
      const tx = await provider.getTransaction(event.transactionHash);
      
      console.log(`\n  🔹 Nullifier: ${event.args.nullifier}`);
      console.log(`     Block: ${event.blockNumber}`);
      console.log(`     Time: ${new Date(block.timestamp * 1000).toLocaleString()}`);
      console.log(`     Tx: ${event.transactionHash}`);
      console.log(`     Recipient: ${tx.from}`);
      
      // Try to get the withdrawal amount from transaction logs
      const receipt = await provider.getTransactionReceipt(event.transactionHash);
      const transferLog = receipt.logs.find(log => 
        log.topics[0] === hre.ethers.id("Transfer(address,address,uint256)")
      );
      
      if (transferLog && transferLog.address === '0x0000000000000000000000000000000000000000') {
        // Native HYPE transfer
        const value = tx.value;
        console.log(`     Amount: ${hre.ethers.formatEther(value)} HYPE`);
      }
    }
  }
  
  // Check nullifier status
  console.log('\n🔒 Checking nullifier usage...');
  const testNullifier = '0x0000000000000000000000000000000000000000000000000000000000000001';
  try {
    const isUsed = await contract.nullifiers(testNullifier);
    console.log(`Test nullifier used: ${isUsed}`);
  } catch (e) {
    console.log('Could not check nullifier status');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });