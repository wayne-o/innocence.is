const hre = require('hardhat');

async function main() {
  const contractAddress = '0x89D8D76237aFAC8ea89872832C21385beEc92419';
  const userAddress = '0x5Bd2F329C50860366c0E6D3b4227a422B66AD203';
  
  console.log('=== DEBUGGING TRADE FUNCTION CALL ===');
  console.log('Contract:', contractAddress);
  console.log('User:', userAddress);
  
  const ABI = [
    'function privateSpotTrade(bytes calldata tradeProof, bytes calldata publicValues) external',
    'function getMerkleRoot() external view returns (bytes32)',
    'function SPOT_BALANCE() external view returns (address)',
    'function ORACLE_PX() external view returns (address)',
    'function HYPERCORE_WRITE() external view returns (address)'
  ];
  
  try {
    const contract = new hre.ethers.Contract(contractAddress, ABI, hre.ethers.provider);
    
    // Check precompile addresses
    console.log('\n--- Precompile Addresses ---');
    try {
      const spotBalance = await contract.SPOT_BALANCE();
      const oraclePx = await contract.ORACLE_PX();
      const hyperCoreWrite = await contract.HYPERCORE_WRITE();
      
      console.log('SPOT_BALANCE:', spotBalance);
      console.log('ORACLE_PX:', oraclePx);
      console.log('HYPERCORE_WRITE:', hyperCoreWrite);
    } catch (precompileError) {
      console.log('❌ Cannot access precompile addresses:', precompileError.message);
    }
    
    // Check merkle root
    const merkleRoot = await contract.getMerkleRoot();
    console.log('\n--- Contract State ---');
    console.log('Merkle Root:', merkleRoot);
    
    // Test precompile functionality directly
    console.log('\n--- Testing Precompiles Directly ---');
    try {
      // Test spot balance precompile at 0x801
      const spotBalancePrecompile = new hre.ethers.Contract(
        '0x0000000000000000000000000000000000000801',
        ['function spotBalance(address user, uint32 coin) external view returns (uint64)'],
        hre.ethers.provider
      );
      
      const balance = await spotBalancePrecompile.spotBalance(userAddress, 0);
      console.log('✅ User HYPE spot balance:', balance.toString());
      
      // Test oracle price precompile at 0x807
      const oraclePrecompile = new hre.ethers.Contract(
        '0x0000000000000000000000000000000000000807',
        ['function oraclePx(uint32 index) external view returns (uint64)'],
        hre.ethers.provider
      );
      
      const price = await oraclePrecompile.oraclePx(1); // USDC
      console.log('✅ USDC oracle price:', price.toString());
      
    } catch (precompileError) {
      console.log('❌ Precompile test failed:', precompileError.message);
      console.log('This suggests precompiles are not working properly');
    }
    
    // Test a simple trade call with mock data
    console.log('\n--- Testing Trade Function Call ---');
    try {
      // Create mock trade data that matches the expected structure
      const mockTradeData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint32', 'bool', 'uint64', 'uint64', 'uint64', 'bytes32'],
        [
          userAddress,    // user
          1,              // coin (USDC)
          true,           // isBuy
          100000,         // limitPx (1.00000 USDC)
          10000,          // sz (0.1 HYPE)
          0,              // minBalance
          merkleRoot      // merkleRoot
        ]
      );
      
      const mockProof = '0x' + 'cd'.repeat(128); // Mock proof data
      
      // Try to estimate gas (this will fail but show us the revert reason)
      await contract.privateSpotTrade.estimateGas(mockProof, mockTradeData);
      console.log('✅ Trade function can be called');
      
    } catch (tradeError) {
      console.log('❌ Trade function failed:', tradeError.message);
      if (tradeError.data) {
        console.log('Revert data:', tradeError.data);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main().catch(console.error);