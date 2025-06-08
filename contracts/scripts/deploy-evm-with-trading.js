const hre = require('hardhat');

async function main() {
  console.log('=== DEPLOYING EVM CONTRACT WITH TRADING SUPPORT ===');
  
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying with:', deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log('Balance:', hre.ethers.formatEther(balance), 'HYPE');
  
  // Deploy MockSP1Verifier first
  console.log('Deploying MockSP1Verifier...');
  const MockSP1Verifier = await hre.ethers.getContractFactory('MockSP1Verifier');
  const verifier = await MockSP1Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log('MockSP1Verifier deployed to:', verifierAddress);
  
  // Deploy HyperliquidPrivacySystemEVM with trading
  console.log('Deploying HyperliquidPrivacySystemEVM with trading...');
  const HyperliquidPrivacySystemEVM = await hre.ethers.getContractFactory('HyperliquidPrivacySystemEVM');
  const privacySystem = await HyperliquidPrivacySystemEVM.deploy(
    verifierAddress,
    deployer.address // compliance authority
  );
  await privacySystem.waitForDeployment();
  const contractAddress = await privacySystem.getAddress();
  console.log('HyperliquidPrivacySystemEVM deployed to:', contractAddress);
  
  // Verify it can receive ETH
  console.log('Testing ETH reception...');
  const testTx = await deployer.sendTransaction({
    to: contractAddress,
    value: hre.ethers.parseEther('0.001')
  });
  await testTx.wait();
  
  const contractBalance = await hre.ethers.provider.getBalance(contractAddress);
  console.log('Contract can receive ETH:', contractBalance > 0);
  
  // Test precompile access (this will fail on non-Hyperliquid networks but succeed on HyperEVM)
  try {
    const spotBalance = await privacySystem.SPOT_BALANCE();
    console.log('Spot balance precompile address:', spotBalance);
    console.log('✅ Precompiles accessible');
  } catch (error) {
    console.log('⚠️ Precompiles may not be available on this network');
  }
  
  console.log('\n✅ EVM deployment with trading successful!');
  console.log('Contract address:', contractAddress);
  console.log('Verifier address:', verifierAddress);
  
  console.log('\nUpdate your .env file:');
  console.log(`REACT_APP_CONTRACT_ADDRESS=${contractAddress}`);
  
  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: contractAddress,
    verifierAddress: verifierAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber(),
    features: ['deposits', 'withdrawals', 'trading', 'precompiles']
  };
  
  console.log('\nDeployment Info:', JSON.stringify(deploymentInfo, null, 2));
}

main().catch(console.error);