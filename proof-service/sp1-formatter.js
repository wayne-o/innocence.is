const { ethers } = require('ethers');

/**
 * Formats an SP1 proof for the SP1VerifierGroth16 contract
 * @param {Object} sp1Proof - The raw SP1 proof from the Rust prover
 * @returns {string} - Properly formatted proof bytes for the verifier
 */
function formatSP1ProofForVerifier(sp1Proof) {
  // Check if proof already has rawBytes from Rust (new format)
  if (sp1Proof && sp1Proof.rawBytes) {
    // Already formatted by Rust prover with Groth16
    return sp1Proof.rawBytes;
  }
  
  // SP1VerifierGroth16 expects:
  // - 4-byte verifier selector
  // - 8 uint256 values (Groth16 proof points)
  
  const VERIFIER_SELECTOR = '0xa4594c59';
  
  // Extract Groth16 proof points from SP1 proof structure
  // This is based on the SP1 proof format from the Rust SDK
  let groth16Points = [];
  
  try {
    if (sp1Proof && sp1Proof.proof && sp1Proof.proof.Groth16) {
      // Direct Groth16 format
      const g16 = sp1Proof.proof.Groth16;
      if (g16.a && g16.b && g16.c) {
        // Standard Groth16 proof has points a, b, c
        // Convert to the format expected by the verifier
        groth16Points = [
          BigInt(g16.a[0] || 0),
          BigInt(g16.a[1] || 0),
          BigInt(g16.b[0][0] || 0),
          BigInt(g16.b[0][1] || 0),
          BigInt(g16.b[1][0] || 0),
          BigInt(g16.b[1][1] || 0),
          BigInt(g16.c[0] || 0),
          BigInt(g16.c[1] || 0)
        ];
      }
    } else if (sp1Proof && sp1Proof.proof && sp1Proof.proof.Core) {
      // Core proof format - need to convert to Groth16
      // This is a simplified extraction - in production, use proper SP1 SDK conversion
      const core = sp1Proof.proof.Core[0];
      if (core && core.commitment) {
        const commitment = core.commitment;
        groth16Points = [
          BigInt(commitment.main_commit?.value?.[0] || 0),
          BigInt(commitment.main_commit?.value?.[1] || 0),
          BigInt(commitment.permutation_commit?.value?.[0] || 0),
          BigInt(commitment.permutation_commit?.value?.[1] || 0),
          BigInt(commitment.quotient_commit?.value?.[0] || 0),
          BigInt(commitment.quotient_commit?.value?.[1] || 0),
          BigInt(commitment.quotient_commit?.value?.[2] || 0),
          BigInt(commitment.quotient_commit?.value?.[3] || 0)
        ];
      }
    }
    
    // If we still don't have valid points, use placeholder
    if (groth16Points.length !== 8) {
      console.warn('Invalid SP1 proof format, using placeholder values');
      groth16Points = new Array(8).fill(BigInt(0));
    }
    
  } catch (error) {
    console.error('Error extracting Groth16 points:', error);
    groth16Points = new Array(8).fill(BigInt(0));
  }
  
  // Encode the proof data
  const proofWithoutSelector = ethers.AbiCoder.defaultAbiCoder().encode(
    ['uint256[8]'],
    [groth16Points]
  );
  
  // Combine selector + proof data
  const formattedProof = VERIFIER_SELECTOR + proofWithoutSelector.slice(2);
  
  return formattedProof;
}

/**
 * Encodes public values for different proof types
 * @param {string} proofType - The type of proof (compliance, balance, trade)
 * @param {Object} publicValues - The public values to encode
 * @returns {string} - ABI encoded public values
 */
function encodePublicValues(proofType, publicValues) {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  
  switch (proofType) {
    case 'compliance':
      return abiCoder.encode(
        ['bytes32', 'address', 'uint256', 'bytes32'],
        [
          publicValues.commitment,
          publicValues.complianceAuthority,
          publicValues.validUntil,
          publicValues.certificateHash
        ]
      );
      
    case 'balance':
      return abiCoder.encode(
        ['bytes32', 'bytes32', 'uint256', 'uint64'],
        [
          publicValues.commitment,
          publicValues.merkleRoot,
          publicValues.minBalance,
          publicValues.assetId
        ]
      );
      
    case 'trade':
      return abiCoder.encode(
        ['bytes32', 'bytes32', 'uint64', 'uint64', 'uint256', 'uint256', 'uint256', 'bytes32'],
        [
          publicValues.commitment,
          publicValues.nullifierHash,
          publicValues.fromAsset,
          publicValues.toAsset,
          publicValues.fromAmount,
          publicValues.minToAmount,
          publicValues.depositedAmount,
          publicValues.merkleRoot
        ]
      );
      
    case 'innocence':
      return abiCoder.encode(
        ['address', 'bytes32', 'uint256', 'bool'],
        [
          publicValues.depositor,
          publicValues.sanctionsRoot,
          publicValues.timestamp,
          publicValues.isInnocent
        ]
      );
      
    default:
      throw new Error('Unknown proof type: ' + proofType);
  }
}

module.exports = {
  formatSP1ProofForVerifier,
  encodePublicValues
};