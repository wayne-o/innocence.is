const { ethers } = require("hardhat");

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.hyperliquid-testnet.xyz/evm');
  
  const privacySystemAddress = '0x07Ee16F77aC3BbD59eAaAA1c262629C69B0752dA';
  const privacySystemABI = [
    'function getMerkleRoot() view returns (bytes32)',
    'function commitmentMerkleTree(uint256) view returns (bytes32)',
    'function commitments(bytes32) view returns (bool)',
    'event PrivateDeposit(bytes32 indexed commitment, uint256 timestamp)'
  ];
  
  const privacySystem = new ethers.Contract(privacySystemAddress, privacySystemABI, provider);
  
  console.log('=== SEARCHING FOR USER COMMITMENTS ===');
  
  // Get PrivateDeposit events for the user
  try {
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - 1000); // Last 1k blocks
    
    const filter = privacySystem.filters.PrivateDeposit();
    const events = await privacySystem.queryFilter(filter, fromBlock, latestBlock);
    
    console.log(`Found ${events.length} PrivateDeposit events:`);
    
    for (const event of events) {
      const commitment = event.args.commitment;
      const timestamp = event.args.timestamp;
      const date = new Date(Number(timestamp) * 1000);
      
      console.log(`  Commitment: ${commitment}`);
      console.log(`  Timestamp: ${timestamp} (${date.toISOString()})`);
      console.log(`  Block: ${event.blockNumber}`);
      console.log(`  Tx: ${event.transactionHash}`);
      console.log('---');
    }
    
    // Check the merkle tree structure
    console.log('\n=== MERKLE TREE COMMITMENTS ===');
    try {
      for (let i = 0; i < 10; i++) {
        try {
          const commitment = await privacySystem.commitmentMerkleTree(i);
          if (commitment !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
            console.log(`Tree[${i}]: ${commitment}`);
          } else {
            break; // No more commitments
          }
        } catch (e) {
          break; // End of tree
        }
      }
    } catch (treeError) {
      console.log('Could not read merkle tree:', treeError.message);
    }
    
    // Check specific commitments
    console.log('\n=== CHECKING SPECIFIC COMMITMENTS ===');
    const commitmentToCheck = '0x0d14c75e7812ab5333ee90fc7ab92741f7b04b0ed50f61ce1eb8aa5007253830';
    const proofCommitment = '0x9b24c5744e0d86fec92ebdb9689170d2b049f91a830d93521cbbd8b4a37f4a5d';
    
    console.log(`User commitment (${commitmentToCheck}):`, await privacySystem.commitments(commitmentToCheck));
    console.log(`Proof commitment (${proofCommitment}):`, await privacySystem.commitments(proofCommitment));
    
    console.log('\n=== CURRENT STATE ===');
    console.log('Current merkle root:', await privacySystem.getMerkleRoot());
    
  } catch (error) {
    console.error('Error searching for events:', error.message);
  }
}

main().catch(console.error);