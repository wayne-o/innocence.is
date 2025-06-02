const hre = require('hardhat');

async function main() {
  console.log('=== DEPLOYING PURE EVM CONTRACT TO MAINNET ===');
  
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying with:', deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log('Balance:', hre.ethers.formatEther(balance), 'HYPE');
  
  // Deploy MockSP1Verifier first
  console.log('Deploying MockSP1Verifier...');
  const MockSP1Verifier = await hre.ethers.getContractFactory('MockSP1Verifier');
  const mockVerifier = await MockSP1Verifier.deploy();
  await mockVerifier.waitForDeployment();
  const verifierAddr = await mockVerifier.getAddress();
  console.log('MockSP1Verifier deployed to:', verifierAddr);
  
  // Deploy HyperliquidPrivacySystemEVM
  console.log('Deploying HyperliquidPrivacySystemEVM...');
  const HyperliquidPrivacySystemEVM = await hre.ethers.getContractFactory('HyperliquidPrivacySystemEVM');
  const privacySystem = await HyperliquidPrivacySystemEVM.deploy(
    verifierAddr,
    deployer.address
  );
  
  await privacySystem.waitForDeployment();
  const systemAddr = await privacySystem.getAddress();
  console.log('HyperliquidPrivacySystemEVM deployed to:', systemAddr);
  
  // Test basic functionality
  const merkleRoot = await privacySystem.getMerkleRoot();
  console.log('Merkle root:', merkleRoot);
  
  // Test ETH deposit capability
  const canReceiveETH = await hre.ethers.provider.getCode(systemAddr);
  console.log('Contract can receive ETH:', canReceiveETH.length > 2);
  
  console.log('\n✅ Pure EVM deployment successful!');
  console.log('Contract address:', systemAddr);
  console.log('Verifier address:', verifierAddr);
  console.log('\nUpdate your .env file:');
  console.log(`REACT_APP_CONTRACT_ADDRESS=${systemAddr}`);
}

main().catch(console.error);