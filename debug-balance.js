const { JsonRpcProvider, AbiCoder } = require('ethers');

async function debugBalance() {
  const userAddress = '0xA8b90cEf0e388a23Cf2d3625481ce14D7c53750D';
  
  // Check environment
  console.log('=== DEBUGGING BALANCE FOR ===');
  console.log('Address:', userAddress);
  console.log('');
  
  // Set up provider based on environment
  const isMainnet = true; // Based on .env file
  const rpcUrl = isMainnet 
    ? 'https://rpc.hyperliquid.xyz/evm'
    : 'https://api.hyperliquid-testnet.xyz/evm';
    
  console.log('Network:', isMainnet ? 'MAINNET' : 'TESTNET');
  console.log('RPC URL:', rpcUrl);
  console.log('');
  
  const provider = new JsonRpcProvider(rpcUrl);
  
  // HyperCore Spot Balance Precompile address
  const SPOT_BALANCE_PRECOMPILE = '0x0000000000000000000000000000000000000801';
  
  // Test different token IDs for HYPE
  const possibleHypeTokenIds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  
  console.log('=== TESTING DIFFERENT TOKEN IDs FOR HYPE ===');
  
  for (const tokenId of possibleHypeTokenIds) {
    try {
      // Encode the call data: address (20 bytes) + token index (8 bytes)
      const encodedData = AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint64'],
        [userAddress.toLowerCase(), tokenId]
      );

      // Call the precompile
      const result = await provider.call({
        to: SPOT_BALANCE_PRECOMPILE,
        data: encodedData
      });

      if (result === '0x' || result === '0x0') {
        console.log(`Token ${tokenId}: No balance data`);
        continue;
      }

      // Decode the result - expecting (uint64 total, uint64 hold, uint64 entryNtl)
      const decoded = AbiCoder.defaultAbiCoder().decode(
        ['uint64', 'uint64', 'uint64'],
        result
      );

      const total = BigInt(decoded[0]);
      const hold = BigInt(decoded[1]);
      const entryNtl = BigInt(decoded[2]);
      
      if (total > 0) {
        console.log(`Token ${tokenId}: ✅ FOUND BALANCE!`);
        console.log(`  Total: ${total.toString()}`);
        console.log(`  Hold: ${hold.toString()}`);
        console.log(`  EntryNtl: ${entryNtl.toString()}`);
        
        // Convert to human readable (assuming 8 decimals for now)
        const humanReadable = Number(total) / 1e8;
        console.log(`  Human readable (8 decimals): ${humanReadable}`);
        console.log('');
      } else {
        console.log(`Token ${tokenId}: 0 balance`);
      }
    } catch (error) {
      console.log(`Token ${tokenId}: Error - ${error.message}`);
    }
  }
  
  console.log('=== HYPERLIQUID API TEST ===');
  
  // Test with Hyperliquid API
  try {
    const apiUrl = isMainnet 
      ? 'https://api.hyperliquid.xyz/info'
      : 'https://api.hyperliquid-testnet.xyz/info';
      
    console.log('API URL:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'spotClearinghouseState',
        user: userAddress.toLowerCase()
      })
    });

    const result = await response.json();
    console.log('Hyperliquid API Response:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Hyperliquid API Error:', error.message);
  }
}

debugBalance().catch(console.error);