const hre = require('hardhat');

async function debugTradeIssue() {
  const contractAddress = '0xFB6d3B483676C53C9Bf5A4bE22B175F99c0480ff';
  const userAddress = '0x5Bd2F329C50860366c0E6D3b4227a422B66AD203';
  
  console.log('=== DEBUGGING TRADE ISSUE ===');
  console.log('Contract:', contractAddress);
  console.log('User:', userAddress);
  
  // Check if the contract has the precompile addresses
  const ABI = [
    'function SPOT_BALANCE() external view returns (address)',
    'function ORACLE_PX() external view returns (address)',
    'function HYPERCORE_WRITE() external view returns (address)',
    'function getMerkleRoot() external view returns (bytes32)'
  ];
  
  const contract = new hre.ethers.Contract(contractAddress, ABI, hre.ethers.provider);
  
  try {
    console.log('\n--- Contract Configuration ---');
    const spotBalanceAddr = await contract.SPOT_BALANCE();
    const oraclePxAddr = await contract.ORACLE_PX();
    const hypercoreWriteAddr = await contract.HYPERCORE_WRITE();
    const merkleRoot = await contract.getMerkleRoot();
    
    console.log('SPOT_BALANCE precompile:', spotBalanceAddr);
    console.log('ORACLE_PX precompile:', oraclePxAddr);
    console.log('HYPERCORE_WRITE precompile:', hypercoreWriteAddr);
    console.log('Merkle Root:', merkleRoot);
    
    // Try to call spot balance precompile directly
    console.log('\n--- Testing Precompiles ---');
    
    // Test spot balance for asset 2 (tUSDC)
    const spotBalanceCall = hre.ethers.solidityPacked(['address', 'uint32'], [userAddress, 2]);
    console.log('Spot balance call data:', spotBalanceCall);
    
    try {
      const result = await hre.ethers.provider.call({
        to: spotBalanceAddr,
        data: spotBalanceCall
      });
      console.log('Spot balance result:', result);
    } catch (error) {
      console.log('Spot balance precompile error:', error.message);
    }
    
    // Test oracle price for asset 2
    const oraclePxCall = hre.ethers.solidityPacked(['uint32'], [2]);
    try {
      const priceResult = await hre.ethers.provider.call({
        to: oraclePxAddr,
        data: oraclePxCall
      });
      console.log('Oracle price result:', priceResult);
    } catch (error) {
      console.log('Oracle price precompile error:', error.message);
    }
    
  } catch (error) {
    console.error('Error debugging trade issue:', error.message);
  }
}

debugTradeIssue().catch(console.error);