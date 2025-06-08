const hre = require('hardhat');

async function main() {
  console.log('=== DEPLOYING FULL INNOCENCE SYSTEM ON TESTNET ===');
  
  const [deployer] = await hre.ethers.getSigners();
  const userAddress = '0x5Bd2F329C50860366c0E6D3b4227a422B66AD203';
  
  console.log('Deploying with:', deployer.address);
  console.log('User address:', userAddress);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log('Deployer balance:', hre.ethers.formatEther(balance), 'ETH');
  
  // 1. Deploy Test Tokens
  console.log('\n--- Deploying Test Tokens ---');
  
  // Deploy Test HYPE (18 decimals, 1M supply)
  console.log('Deploying Test HYPE...');
  const TestToken = await hre.ethers.getContractFactory('TestToken');
  const testHYPE = await TestToken.deploy(
    'Test HYPE',
    'tHYPE',
    18,
    1000000 // 1M tokens
  );
  await testHYPE.waitForDeployment();
  const testHYPEAddress = await testHYPE.getAddress();
  console.log('Test HYPE deployed to:', testHYPEAddress);
  
  // Deploy Test USDC (6 decimals like real USDC, 10M supply)
  console.log('Deploying Test USDC...');
  const testUSDC = await TestToken.deploy(
    'Test USDC',
    'tUSDC',
    6,
    10000000 // 10M tokens
  );
  await testUSDC.waitForDeployment();
  const testUSDCAddress = await testUSDC.getAddress();
  console.log('Test USDC deployed to:', testUSDCAddress);
  
  // 2. Deploy Mock SP1 Verifier
  console.log('\n--- Deploying Mock Verifier ---');
  const MockSP1Verifier = await hre.ethers.getContractFactory('MockSP1Verifier');
  const verifier = await MockSP1Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log('MockSP1Verifier deployed to:', verifierAddress);
  
  // 3. Deploy Privacy System with Trading
  console.log('\n--- Deploying Privacy System ---');
  const HyperliquidPrivacySystemEVM = await hre.ethers.getContractFactory('HyperliquidPrivacySystemEVM');
  const privacySystem = await HyperliquidPrivacySystemEVM.deploy(
    verifierAddress,
    deployer.address // compliance authority
  );
  await privacySystem.waitForDeployment();
  const privacySystemAddress = await privacySystem.getAddress();
  console.log('Privacy System deployed to:', privacySystemAddress);
  
  // 4. Configure Token Mappings
  console.log('\n--- Configuring Token Mappings ---');
  
  // Add test tokens to privacy system (token ID 0 = ETH, 1 = tHYPE, 2 = tUSDC)
  console.log('Adding Test HYPE (ID: 1)...');
  await privacySystem.addToken(1, testHYPEAddress);
  
  console.log('Adding Test USDC (ID: 2)...');
  await privacySystem.addToken(2, testUSDCAddress);
  
  // 5. Send Tokens to User
  console.log('\n--- Sending Test Tokens to User ---');
  
  // Send 10,000 Test HYPE to user
  console.log('Sending 10,000 tHYPE to user...');
  await testHYPE.transfer(userAddress, hre.ethers.parseEther('10000'));
  
  // Send 50,000 Test USDC to user (6 decimals)
  console.log('Sending 50,000 tUSDC to user...');
  await testUSDC.transfer(userAddress, hre.ethers.parseUnits('50000', 6));
  
  // Send some ETH to user for gas
  console.log('Sending 1 ETH to user for gas...');
  await deployer.sendTransaction({
    to: userAddress,
    value: hre.ethers.parseEther('1.0')
  });
  
  // 6. Test Precompiles on Testnet
  console.log('\n--- Testing Precompiles on Testnet ---');
  try {
    // Test oracle precompile
    const oraclePrecompile = new hre.ethers.Contract(
      '0x0000000000000000000000000000000000000807',
      ['function oraclePx(uint32 index) external view returns (uint64)'],
      hre.ethers.provider
    );
    
    const price = await oraclePrecompile.oraclePx(0);
    console.log('✅ Oracle precompile working - HYPE price:', price.toString());
    
    // Test spot balance precompile
    const spotBalancePrecompile = new hre.ethers.Contract(
      '0x0000000000000000000000000000000000000801',
      ['function spotBalance(address user, uint32 coin) external view returns (uint64)'],
      hre.ethers.provider
    );
    
    const balance = await spotBalancePrecompile.spotBalance(userAddress, 0);
    console.log('✅ Spot balance precompile working - User balance:', balance.toString());
    
    // Check write system contract
    const writeCode = await hre.ethers.provider.getCode('0x3333333333333333333333333333333333333333');
    if (writeCode !== '0x') {
      console.log('✅ Write system contract available');
    } else {
      console.log('⚠️ Write system contract not available');
    }
    
  } catch (error) {
    console.log('❌ Precompile test failed:', error.message);
  }
  
  // 7. Verify Token Balances
  console.log('\n--- Verifying User Token Balances ---');
  const userHYPE = await testHYPE.balanceOf(userAddress);
  const userUSDC = await testUSDC.balanceOf(userAddress);
  const userETH = await hre.ethers.provider.getBalance(userAddress);
  
  console.log('User tHYPE balance:', hre.ethers.formatEther(userHYPE));
  console.log('User tUSDC balance:', hre.ethers.formatUnits(userUSDC, 6));
  console.log('User ETH balance:', hre.ethers.formatEther(userETH));
  
  // 8. Output Deployment Summary
  console.log('\n✅ TESTNET DEPLOYMENT COMPLETE!');
  console.log('\n--- Deployment Summary ---');
  console.log('Network: Hyperliquid Testnet');
  console.log('Privacy System:', privacySystemAddress);
  console.log('Mock Verifier:', verifierAddress);
  console.log('Test HYPE (tHYPE):', testHYPEAddress);
  console.log('Test USDC (tUSDC):', testUSDCAddress);
  
  console.log('\n--- User Holdings ---');
  console.log('Address:', userAddress);
  console.log('tHYPE: 10,000 tokens');
  console.log('tUSDC: 50,000 tokens');
  console.log('ETH: 1+ for gas');
  
  console.log('\n--- Update Frontend Config ---');
  console.log('REACT_APP_NETWORK=testnet');
  console.log(`REACT_APP_CONTRACT_ADDRESS=${privacySystemAddress}`);
  console.log('REACT_APP_RPC_URL=https://rpc.hyperliquid-testnet.xyz/evm');
  
  console.log('\n--- Token Configuration ---');
  console.log('Token ID 0: Native ETH');
  console.log('Token ID 1: Test HYPE (tHYPE)');
  console.log('Token ID 2: Test USDC (tUSDC)');
  
  // Save deployment info
  const deploymentInfo = {
    network: 'hyperliquid_testnet',
    timestamp: new Date().toISOString(),
    privacySystem: privacySystemAddress,
    verifier: verifierAddress,
    tokens: {
      testHYPE: {
        address: testHYPEAddress,
        symbol: 'tHYPE',
        decimals: 18,
        tokenId: 1
      },
      testUSDC: {
        address: testUSDCAddress,
        symbol: 'tUSDC', 
        decimals: 6,
        tokenId: 2
      }
    },
    userAddress,
    userBalances: {
      tHYPE: '10000',
      tUSDC: '50000',
      ETH: '1+'
    },
    features: ['deposits', 'withdrawals', 'trading', 'precompiles']
  };
  
  console.log('\n--- Full Deployment Info ---');
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main().catch(console.error);