const hre = require('hardhat');

async function main() {
  const contractAddress = '0x20d68Ad4Cd0474028dB80917017b1282b7EcfEe2';
  const tradeTx = '0x91f67fb8e71d65b81aa5a24caa79a8c6d9e5a92b7cfed941f830ccede6e17d98';
  
  console.log('=== VERIFYING TRADE TRANSACTION ===');
  console.log('Contract:', contractAddress);
  console.log('Trade TX:', tradeTx);
  
  const ABI = [
    'function privateSpotTrade(bytes calldata tradeProof, bytes calldata publicValues) external',
    'event PrivateSpotTrade(address indexed user, uint256 timestamp)',
    'event Error(string message)'
  ];
  
  try {
    // Get transaction details
    const tx = await hre.ethers.provider.getTransaction(tradeTx);
    console.log('\n--- Transaction Data ---');
    console.log('To:', tx.to);
    console.log('From:', tx.from);
    console.log('Value:', hre.ethers.formatEther(tx.value || 0), 'ETH');
    console.log('Gas Limit:', tx.gasLimit.toString());
    
    // Get transaction receipt
    const receipt = await hre.ethers.provider.getTransactionReceipt(tradeTx);
    console.log('\n--- Transaction Receipt ---');
    console.log('Status:', receipt.status === 1 ? 'SUCCESS ✅' : 'FAILED ❌');
    console.log('Gas Used:', receipt.gasUsed.toString());
    console.log('Number of logs:', receipt.logs.length);
    
    if (receipt.status === 0) {
      console.log('❌ TRANSACTION FAILED - Trade was not successful');
      return;
    }
    
    // Parse logs to find events
    const iface = new hre.ethers.Interface(ABI);
    let tradeEventFound = false;
    let errorFound = false;
    
    console.log('\n--- Event Analysis ---');
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed.name === 'PrivateSpotTrade') {
          tradeEventFound = true;
          console.log('✅ PrivateSpotTrade Event Found:');
          console.log('  User:', parsed.args.user);
          console.log('  Timestamp:', parsed.args.timestamp.toString());
        } else if (parsed.name === 'Error') {
          errorFound = true;
          console.log('❌ Error Event Found:');
          console.log('  Message:', parsed.args.message);
        }
      } catch (parseError) {
        // Try raw log analysis if specific parsing fails
        console.log('Raw log:', log);
      }
    }
    
    if (receipt.logs.length === 0) {
      console.log('⚠️  No events emitted - this may indicate the trade function was called but no events were triggered');
    }
    
    // Decode the function call to see what was attempted
    try {
      const decoded = iface.parseTransaction({ data: tx.data });
      console.log('\n--- Function Call Analysis ---');
      console.log('Function called:', decoded.name);
      console.log('Trade proof length:', decoded.args[0].length);
      console.log('Public values length:', decoded.args[1].length);
    } catch (decodeError) {
      console.log('\n--- Function Call Decode Error ---');
      console.log('Could not decode function call:', decodeError.message);
    }
    
    // Final assessment
    console.log('\n--- TRADE VERIFICATION RESULT ---');
    if (receipt.status === 1) {
      if (tradeEventFound) {
        console.log('✅ TRADE SUCCESSFUL: Transaction succeeded and PrivateSpotTrade event was emitted');
      } else if (errorFound) {
        console.log('❌ TRADE FAILED: Transaction succeeded but error event was emitted');
      } else if (receipt.logs.length === 0) {
        console.log('⚠️  TRADE STATUS UNCLEAR: Transaction succeeded but no events emitted');
        console.log('   This may indicate the function executed but the trading logic did not complete as expected');
      } else {
        console.log('⚠️  TRADE STATUS UNCLEAR: Transaction succeeded but no recognizable events found');
      }
    } else {
      console.log('❌ TRADE FAILED: Transaction was reverted');
    }
    
  } catch (error) {
    console.error('Error verifying trade:', error.message);
  }
}

main().catch(console.error);