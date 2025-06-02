const hre = require('hardhat');

async function main() {
  console.log('=== CHECKING COMMITMENT ACROSS ALL CONTRACTS ===');
  
  const commitment = '0xb4f336a69f848e7891a208dfcdc595e12da97915b470b070672dbc5be4d1127d';
  const nullifier = '0x908610bbcf72d630fe40b5a5cb2deff21a5b0dd25ce0bb83297ab3f67681e757';
  
  console.log('Commitment:', commitment);
  console.log('Nullifier:', nullifier);
  
  const contracts = [
    { name: 'Newly Deployed V5', address: '0x85a562c72b68a9b9E482B2f44814acB116a37422' },
    { name: 'Old Recovery System', address: '0x38957E2052AfFff204C4EA8Ae88cDA805C58B7b9' },
    { name: 'Pure EVM System', address: '0x60564ff628987871EFFF0A2Ec8b6EF722895152e' }
  ];
  
  const ABI = [
    'function commitments(bytes32) external view returns (bool)',
    'function nullifiers(bytes32) external view returns (bool)'
  ];
  
  for (const contractInfo of contracts) {
    console.log(`\n--- ${contractInfo.name} ---`);
    console.log('Address:', contractInfo.address);
    
    try {
      // Check if contract exists
      const code = await hre.ethers.provider.getCode(contractInfo.address);
      if (code === '0x') {
        console.log('❌ No contract deployed at this address');
        continue;
      }
      
      const contract = new hre.ethers.Contract(contractInfo.address, ABI, hre.ethers.provider);
      
      const commitmentExists = await contract.commitments(commitment);
      const nullifierUsed = await contract.nullifiers(nullifier);
      
      console.log('✅ Commitment exists:', commitmentExists);
      console.log('❌ Nullifier used:', nullifierUsed);
      
      if (commitmentExists) {
        console.log('🎉 FOUND! Commitment is recorded in this contract!');
        return;
      }
      
    } catch (error) {
      console.log('❌ Error checking contract:', error.message);
    }
  }
  
  console.log('\n💔 CONCLUSION: Commitment not found in any checked contracts');
  console.log('This indicates the deposit was never completed on-chain.');
}

main().catch(console.error);