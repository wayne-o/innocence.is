const hre = require('hardhat');

async function checkTokenConfig() {
  const contractAddress = '0xFB6d3B483676C53C9Bf5A4bE22B175F99c0480ff'; // Your deposit contract
  
  console.log('🔍 Checking Token Configuration...');
  console.log('Contract:', contractAddress);
  
  const CONTRACT_ABI = [
    'function tokenAddresses(uint64) view returns (address)',
    'function prepareDeposit(uint64 token, uint256 amount) external',
    'function owner() view returns (address)'
  ];
  
  const [signer] = await hre.ethers.getSigners();
  const contract = new hre.ethers.Contract(contractAddress, CONTRACT_ABI, signer);
  
  try {
    // Check owner
    const owner = await contract.owner();
    console.log('Owner:', owner);
    
    // Check common token IDs
    const tokens = [
      { id: 0, name: 'Native (HYPE)' },
      { id: 1, name: 'USDC' },
      { id: 2, name: 'ETH' },
      { id: 150, name: 'Test USDC' }
    ];
    
    console.log('\n📋 Token Configuration:');
    for (const token of tokens) {
      try {
        const address = await contract.tokenAddresses(token.id);
        console.log(`${token.name} (ID ${token.id}): ${address}`);
      } catch (error) {
        console.log(`${token.name} (ID ${token.id}): ❌ Error reading`);
      }
    }
    
    // Try to call prepareDeposit
    console.log('\n🧪 Testing prepareDeposit...');
    try {
      // Test with native token (0) and small amount
      const tx = await contract.prepareDeposit(0, hre.ethers.parseEther('0.001'));
      console.log('✅ prepareDeposit call successful:', tx.hash);
    } catch (error) {
      console.log('❌ prepareDeposit failed:', error.message);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkTokenConfig().catch(console.error);