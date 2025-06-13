const { ethers } = require("ethers");

// Transaction data from the error - UPDATED
const txData = "0xa8ebbae6ef40bd5f1a5936289532b04be0da46e6169b53e26bd3df775a03add1f244f255000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000bb80000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0db00a6ecfae3b0f37d1bdb5c77a10d23ef5321982fc466db035b08beadfb9dd200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000016345785d8a000000000000000000000000000000000000000000000000000001606f3d18af9800";

// Function selector (first 4 bytes)
const selector = txData.slice(0, 10);
console.log("Function selector:", selector);

// ABI for decoding
const abi = [
  "function privateSwap(bytes32 nullifier, bytes calldata proof, bytes calldata publicValues, uint24 fee) external returns (uint256 amountOut)"
];

const iface = new ethers.Interface(abi);

try {
  const decoded = iface.parseTransaction({ data: txData });
  console.log("\nFunction:", decoded.name);
  console.log("\nArguments:");
  console.log("- Nullifier:", decoded.args[0]);
  console.log("- Proof length:", decoded.args[1].length);
  console.log("- Proof:", decoded.args[1]);
  console.log("- Public values length:", decoded.args[2].length);
  console.log("- Fee:", decoded.args[3]);
  
  // Decode public values based on new structure
  const publicValues = decoded.args[2];
  console.log("\nPublic values raw:", publicValues);
  
  // Try to decode with the new structure
  const decodedPublicValues = ethers.AbiCoder.defaultAbiCoder().decode(
    ['bytes32', 'bytes32', 'uint64', 'uint64', 'uint256', 'uint256', 'uint256', 'bytes32'],
    publicValues
  );
  
  console.log("\nDecoded public values:");
  console.log("- Commitment:", decodedPublicValues[0]);
  console.log("- Nullifier Hash:", decodedPublicValues[1]);
  console.log("- From Asset:", decodedPublicValues[2].toString());
  console.log("- To Asset:", decodedPublicValues[3].toString());
  console.log("- From Amount:", ethers.formatEther(decodedPublicValues[4]));
  console.log("- Min To Amount:", ethers.formatEther(decodedPublicValues[5]));
  console.log("- Deposited Amount:", ethers.formatEther(decodedPublicValues[6]));
  console.log("- Merkle Root:", decodedPublicValues[7]);
  
} catch (error) {
  console.error("Error decoding:", error.message);
}