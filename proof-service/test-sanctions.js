const sanctionsOracle = require('./sanctions-oracle');

console.log('Testing Sanctions Oracle...\n');

// Test addresses
const testAddresses = [
  // Clean addresses
  { address: '0x5Bd2F329C50860366c0E6D3b4227a422B66AD203', expected: false, label: 'Clean user address' },
  { address: '0x742d35cc6634c0532925a3b844bc9e7595f89590', expected: false, label: 'Random clean address' },
  
  // Sanctioned addresses (Tornado Cash)
  { address: '0x8589427373D6D84E98730D7795D8f6f8731FDA16', expected: true, label: 'Tornado Cash Router' },
  { address: '0x722122dF12D4e14e13Ac3b6895a86e84145b6967', expected: true, label: 'Tornado Cash Proxy' },
  
  // Case insensitive test
  { address: '0x722122df12d4e14e13ac3b6895a86e84145b6967', expected: true, label: 'Tornado Cash (lowercase)' },
];

console.log(`Total sanctioned addresses: ${sanctionsOracle.getAllSanctioned().length}\n`);

// Test each address
testAddresses.forEach(test => {
  try {
    const result = sanctionsOracle.isSanctioned(test.address);
    const status = result === test.expected ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test.label}`);
    console.log(`   Address: ${test.address}`);
    console.log(`   Expected: ${test.expected}, Got: ${result}\n`);
  } catch (error) {
    console.log(`❌ ERROR ${test.label}`);
    console.log(`   Address: ${test.address}`);
    console.log(`   Error: ${error.message}\n`);
  }
});

// Test full status check
console.log('\nTesting full status check:');
const status = sanctionsOracle.getSanctionsStatus('0x5Bd2F329C50860366c0E6D3b4227a422B66AD203');
console.log(JSON.stringify(status, null, 2));

// Show sanctions root
console.log('\nCurrent sanctions root:', sanctionsOracle.getSanctionsRoot());

// Test error handling
console.log('\nTesting error handling:');
try {
  sanctionsOracle.isSanctioned('invalid-address');
} catch (error) {
  console.log('✅ Correctly rejected invalid address:', error.message);
}

console.log('\n✨ Sanctions oracle tests complete!');