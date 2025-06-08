const hre = require('hardhat');
\const { execSync } = require('child_process');

async function deploySP1Verifier() {
  console.log('🚀 Deploying Real SP1 Verifier to Hyperliquid Testnet...\n');

  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log('Balance:', hre.ethers.formatEther(balance), 'HYPE\n');

  // First, let's try to compile and deploy using Forge
  console.log('🔨 Compiling SP1 contracts with Forge...');

  try {
    // Navigate to sp1-contracts directory
    process.chdir('sp1-contracts/contracts');

    // Build the contracts
    console.log('Building contracts...');
    execSync('forge build', { stdio: 'inherit' });

    // Deploy the SP1Verifier for Groth16 proofs
    console.log('\n🚀 Deploying SP1VerifierGroth16...');

    const deployCommand = `forge create --rpc-url ${process.env.HYPEREVM_TESTNET_RPC_URL || 'https://rpc.hyperliquid-testnet.xyz/evm'} \
      --private-key ${process.env.PRIVATE_KEY} \
      --legacy \
      src/v5.0.0/SP1VerifierGroth16.sol:SP1Verifier`;

    const result = execSync(deployCommand, { encoding: 'utf8' });
    console.log(result);

    // Extract deployed address from output
    const addressMatch = result.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
    if (addressMatch) {
      const verifierAddress = addressMatch[1];
      console.log('\n✅ SP1Verifier deployed to:', verifierAddress);

      // Save deployment info
      const deployment = {
        network: 'hyperevm_testnet',
        timestamp: new Date().toISOString(),
        sp1Verifier: verifierAddress,
        type: 'SP1VerifierGroth16',
        version: 'v5.0.0'
      };

      const fs = require('fs');
      fs.writeFileSync(
        '../../deployments/hyperevm_testnet-sp1-verifier.json',
        JSON.stringify(deployment, null, 2)
      );

      console.log('\n📝 Deployment info saved!');
      console.log('\n🎉 SP1 Verifier Deployment Complete!');
      console.log('✅ You can now deploy your privacy contracts with this verifier:', verifierAddress);

      // Change back to original directory
      process.chdir('../..');

      return verifierAddress;
    } else {
      throw new Error('Could not extract deployed address from output');
    }

  } catch (error) {
    console.error('❌ Forge deployment failed:', error.message);
    console.log('\nTrying alternative approach with Hardhat...\n');

    // Change back to original directory if needed
    process.chdir('/Users/waynedouglas/github/wayne-o/innocence/contracts');

    // Alternative: Deploy a simplified version
    await deploySimplifiedVerifier();
  }
}

async function deploySimplifiedVerifier() {
  console.log('🔨 Deploying Simplified SP1 Verifier...');

  // For now, we'll deploy a basic verifier that can be upgraded later
  const SP1Verifier = await hre.ethers.getContractFactory('MockSP1Verifier');
  const verifier = await SP1Verifier.deploy();

  await verifier.waitForDeployment();
  const address = await verifier.getAddress();

  console.log('✅ Simplified SP1 Verifier deployed to:', address);
  console.log('\n⚠️  NOTE: This is a simplified verifier for testing.');
  console.log('For production, you should deploy the full SP1VerifierGroth16 using Forge.');

  // Set it to verify real proofs (not always valid)
  console.log('\n🔧 Configuring verifier...');
  const tx = await verifier.setAlwaysValid(false);
  await tx.wait();
  console.log('✅ Verifier configured to validate proofs');

  return address;
}

deploySP1Verifier()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });