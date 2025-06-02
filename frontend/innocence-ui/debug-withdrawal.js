// Debug withdrawal locally
const { keccak256, toUtf8Bytes, AbiCoder } = require('ethers');

// Data from the commitment file
const commitment = "0x4e5ee6d33f4321419a609fa2d433a65aed4ec7aa06c97e61135fe418cc879c96";
const secret = "0xa082b7e8cad89f7e160b6671e669b411d10922fef9e75175b23f3fa576f225ca";
const nullifier = "0x2d4ee0ce33b1ff5ecf57eb2c3e7e4648c8ba462719075c30258e7ae18925c5df";

console.log("=== Withdrawal Debug ===");
console.log("Commitment:", commitment);
console.log("Secret:", secret);
console.log("Nullifier:", nullifier);

// Calculate nullifier hash like the frontend does
const nullifierHash = keccak256(toUtf8Bytes(nullifier));
console.log("Calculated Nullifier Hash:", nullifierHash);

// Check if this matches what was logged
const loggedNullifier = "0x9aca594b98443ed9b0490026acb2a859e17f2c78e8a5fa1a891491c63755f1a4";
console.log("Logged Nullifier:", loggedNullifier);
console.log("Nullifiers match:", nullifierHash === loggedNullifier);

// Check the merkle root from contract
const contractMerkleRoot = "0x74659c612b79d47471778de7976739638c107911fcf9ad28018ae4ba4388bc5a";
console.log("Contract Merkle Root:", contractMerkleRoot);

// Build the public values that would be sent
const publicValues = AbiCoder.defaultAbiCoder().encode(
  ['bytes32', 'bytes32', 'uint256', 'uint64'],
  [
    commitment,
    contractMerkleRoot,
    12000000, // Amount being withdrawn
    150 // Token ID
  ]
);
console.log("Encoded Public Values:", publicValues);

// Verify commitment calculation
const calculatedCommitment = keccak256(Buffer.concat([
  Buffer.from(secret.slice(2), 'hex'),
  Buffer.from(nullifier.slice(2), 'hex')
]));
console.log("Calculated Commitment:", calculatedCommitment);
console.log("Commitments match:", calculatedCommitment === commitment);