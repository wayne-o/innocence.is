const hre = require('hardhat');

async function configureTokens() {
  const contractAddress = '0xdDe7C2a318ce8FadcD42ef56B0ef7bb4e0c897aB'; // New privacy contract
  
  console.log('🔧 Configuring Tokens for Privacy System...');
  console.log('Contract:', contractAddress);
  
  const [signer] = await hre.ethers.getSigners();
  console.log('Signer:', signer.address);
  
  const CONTRACT_ABI = [
    'function addToken(uint64 tokenId, address tokenAddress) external',
    'function tokenAddresses(uint64) view returns (address)',
    'function complianceAuthority() view returns (address)',
    'event TokenAdded(uint64 indexed tokenId, address tokenAddress)'
  ];
  
  const contract = new hre.ethers.Contract(contractAddress, CONTRACT_ABI, signer);
  
  try {
    // Check compliance authority
    const authority = await contract.complianceAuthority();
    console.log('Compliance Authority:', authority);
    
    if (authority.toLowerCase() !== signer.address.toLowerCase()) {
      console.log('❌ You are not the compliance authority!');
      return;
    }
    
    // Tokens to configure
    const tokens = [
      { id: 1, name: 'tUSDC', address: '0xeF2224b2032c05C6C7b48355957F3C67191ac81e' },
      { id: 2, name: 'tHYPE', address: '0xb82Ca57F6Cc814e945eA999C1B0Ce5ECae156082' }
    ];
    
    console.log('\n📋 Configuring tokens...');
    
    for (const token of tokens) {
      // Check if already configured
      const currentAddress = await contract.tokenAddresses(token.id);
      
      if (currentAddress !== '0x0000000000000000000000000000000000000000') {
        console.log(`✅ Token ${token.name} (ID ${token.id}) already configured: ${currentAddress}`);
      } else {
        console.log(`🔧 Adding ${token.name} (ID ${token.id})...`);
        const tx = await contract.addToken(token.id, token.address);
        await tx.wait();
        console.log(`✅ ${token.name} configured at: ${token.address}`);
      }
    }
    
    // Verify configuration
    console.log('\n📊 Token Configuration:');
    console.log('Token ID 0 (Native):', await contract.tokenAddresses(0));
    console.log('Token ID 1 (tUSDC):', await contract.tokenAddresses(1));
    console.log('Token ID 2 (tHYPE):', await contract.tokenAddresses(2));
    
    console.log('\n✅ Token configuration complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

configureTokens().catch(console.error);