const hre = require('hardhat');

async function deployEVMTrading() {
  console.log('🚀 Deploying Pure EVM Trading Contract...');
  
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  // Configuration - use existing contracts
  const config = {
    depositContract: '0xFB6d3B483676C53C9Bf5A4bE22B175F99c0480ff', // Your working deposit contract
    sp1Verifier: '0x3B6041173B80E77f038f3F2C0f9744f04837185e',     // Existing SP1 verifier
    network: 'hyperevm_testnet'
  };
  
  console.log('\n📋 Configuration:');
  console.log('Deposit Contract:', config.depositContract);
  console.log('SP1 Verifier:', config.sp1Verifier);
  console.log('Network:', config.network);
  
  try {
    // Deploy the EVM trading contract
    console.log('\n🔨 Deploying EVM trading contract...');
    const EVMTradingContract = await hre.ethers.getContractFactory('HyperliquidEVMTrading');
    
    const evmTrading = await EVMTradingContract.deploy(
      config.sp1Verifier,
      config.depositContract
    );
    
    await evmTrading.waitForDeployment();
    const evmTradingAddress = await evmTrading.getAddress();
    
    console.log('✅ HyperliquidEVMTrading deployed to:', evmTradingAddress);
    
    // Test basic functions
    console.log('\n🧪 Testing basic functions...');
    
    try {
      const merkleRoot = await evmTrading.getMerkleRoot();
      console.log('✅ getMerkleRoot():', merkleRoot);
      
      const owner = await evmTrading.owner();
      console.log('✅ Owner:', owner);
      
      const tradeCounter = await evmTrading.tradeCounter();
      console.log('✅ Trade counter:', tradeCounter.toString());
      
      // Test commitment validation
      const testCommitment = '0x527b2486e777d1031d027cc06218062581f43c8718bce7ea83e27a4a6544f04b';
      const isValid = await evmTrading.isCommitmentValid(testCommitment);
      console.log('✅ Test commitment valid:', isValid);
      
    } catch (error) {
      console.log('⚠️  Some functions failed:', error.message);
    }
    
    // Save deployment info
    const deploymentInfo = {
      network: config.network,
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      contracts: {
        evmTradingContract: evmTradingAddress,
        depositContract: config.depositContract,
        sp1Verifier: config.sp1Verifier
      },
      features: {
        pureEVMTrading: true,
        commitmentBalances: true,
        noPrecompileDependency: true,
        zkProofVerification: true
      }
    };
    
    const fs = require('fs');
    const deploymentFile = `deployments/${config.network}-evm-trading-deployment.json`;
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    
    console.log('\n💾 Deployment info saved to:', deploymentFile);
    
    console.log('\n🎉 EVM Trading Contract Deployment Complete!');
    console.log('\n📝 Next Steps:');
    console.log('1. Initialize commitment balances for existing deposits');
    console.log('2. Update frontend to use pure EVM trading contract');
    console.log('3. Test private trading with existing commitments');
    console.log('\n🔗 EVM Trading Contract:', evmTradingAddress);
    console.log('\n💡 This contract works with your existing deposit balances!');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    throw error;
  }
}

deployEVMTrading()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });