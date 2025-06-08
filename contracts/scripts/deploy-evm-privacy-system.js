const hre = require('hardhat');

async function main() {
  console.log('🚀 Deploying Pure EVM Privacy System with Real SP1 Verifier...\n');

  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log('Balance:', hre.ethers.formatEther(balance), 'HYPE\n');

  // Real SP1VerifierGroth16 deployed address
  const sp1VerifierAddress = '0x90067a057D526AE2AcD13DfEc655Aa94aAe72693';
  console.log('Using Real SP1VerifierGroth16 at:', sp1VerifierAddress);

  // Compliance authority
  const complianceAuthority = deployer.address;
  console.log('Compliance Authority:', complianceAuthority);

  // Deploy the HyperliquidPrivacySystemEVM
  console.log('\n📄 Deploying HyperliquidPrivacySystemEVM (Pure EVM)...');
  const PrivacySystem = await hre.ethers.getContractFactory('HyperliquidPrivacySystemEVM');
  const privacySystem = await PrivacySystem.deploy(
    sp1VerifierAddress,
    complianceAuthority
  );

  await privacySystem.waitForDeployment();
  const privacySystemAddress = await privacySystem.getAddress();

  console.log('✅ EVM Privacy System deployed to:', privacySystemAddress);

  // Configure tokens for EVM
  console.log('\n🔧 Configuring tokens...');
  
  // Native HYPE (ID 0)
  console.log('Setting native HYPE (ID: 0)...');
  // Native token doesn't need an address

  // Test tokens for testnet
  if (process.env.REACT_APP_TEST_HYPE_ADDRESS) {
    console.log('Adding tHYPE (ID: 2)...');
    const tx1 = await privacySystem.setTokenAddress(2, process.env.REACT_APP_TEST_HYPE_ADDRESS);
    await tx1.wait();
    console.log('✅ tHYPE configured');
  }

  if (process.env.REACT_APP_TEST_USDC_ADDRESS) {
    console.log('Adding tUSDC (ID: 1)...');
    const tx2 = await privacySystem.setTokenAddress(1, process.env.REACT_APP_TEST_USDC_ADDRESS);
    await tx2.wait();
    console.log('✅ tUSDC configured');
  }

  // Save deployment info
  const deployment = {
    network: 'hyperevm_testnet',
    timestamp: new Date().toISOString(),
    contracts: {
      privacySystem: privacySystemAddress,
      sp1Verifier: sp1VerifierAddress,
      complianceAuthority: complianceAuthority
    },
    contractType: 'HyperliquidPrivacySystemEVM',
    verifierType: 'SP1VerifierGroth16 (Real)',
    version: 'v5.0.0',
    features: ['Pure EVM', 'Real SP1 Verification', 'Native + ERC20 Support']
  };

  const fs = require('fs');
  const path = require('path');
  const deploymentPath = path.join(__dirname, '../deployments/hyperevm_testnet-evm-sp1-deployment.json');
  
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

  console.log('\n📝 Deployment info saved!');
  console.log('\n🎉 Deployment Complete!');
  console.log('✅ Pure EVM Privacy System:', privacySystemAddress);
  console.log('\n✨ Features:');
  console.log('- 100% EVM compatible');
  console.log('- Real SP1 proof verification');
  console.log('- Native HYPE + ERC20 support');
  console.log('- No Core/L1 dependencies');
  
  return privacySystemAddress;
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });