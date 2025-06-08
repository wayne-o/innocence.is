const hre = require('hardhat');
const { keccak256, AbiCoder, toUtf8Bytes } = require('ethers');

async function main() {
  console.log('🔧 Registering valid proof for testing...\n');

  const [signer] = await hre.ethers.getSigners();
  console.log('Using account:', signer.address);

  // Get the mock verifier
  const verifierAddress = '0x83F27Afb7d436B2089f6D78858e1d81FbaC562FE';
  const verifier = await hre.ethers.getContractAt('MockSP1Verifier', verifierAddress);

  // For testing, we'll register the proof hash that the frontend generates
  // This is the commitment we're testing with
  const commitment = '0x3724e62280d0ec921cce305535f97955a66e12a1215cffd71c1361fb02104afe';
  const complianceAuthority = '0x5Bd2F329C50860366c0E6D3b4227a422B66AD203';
  
  // Generate expected public values (matching frontend)
  const publicValues = AbiCoder.defaultAbiCoder().encode(
    ['bytes32', 'address', 'uint256', 'bytes32'],
    [
      commitment,
      complianceAuthority,
      Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // Valid for 1 year
      keccak256(toUtf8Bytes('certificate'))
    ]
  );

  // The proof bytes from the frontend (simplified hash format)
  const proofBytes = '0x461cd5c11f5a6f8f1ca4a09489c1cfe8abf04736b03e9cb9aa542199de2071ef461cd5c11f5a6f8f1ca4a09489c1cfe8abf04736b03e9cb9aa542199de2071ef';
  
  // The vkey for compliance proofs
  const vkey = '0x00620a6540c07b8f7eb5bb74784bb14e48d13bb04b4bbfee6c0d7b30cb4cf3f0';

  // Calculate the proof hash that the verifier will check
  const proofHash = keccak256(
    hre.ethers.concat([
      vkey,
      publicValues,
      proofBytes
    ])
  );

  console.log('Proof hash:', proofHash);

  // Register this proof as valid
  const tx = await verifier.setValidProof(proofHash, true);
  await tx.wait();

  console.log('✅ Proof registered as valid!');
  console.log('\nYou can now test deposits with this specific proof.');
  
  // Also set alwaysValid to true for easier testing
  console.log('\n🔧 Setting verifier to always valid mode for testing...');
  const tx2 = await verifier.setAlwaysValid(true);
  await tx2.wait();
  console.log('✅ Verifier set to always valid mode!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });