// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ISP1Verifier.sol";

/// @notice Mock SP1 Verifier for testing
/// @dev In production, use the official SP1Verifier deployment
contract MockSP1Verifier is ISP1Verifier {
    mapping(bytes32 => bool) public validProofs;
    bool public alwaysValid = true;

    event ProofVerified(bytes32 vkey, bytes32 publicValuesHash, bytes32 proofHash);

    function setAlwaysValid(bool _alwaysValid) external {
        alwaysValid = _alwaysValid;
    }

    function setValidProof(bytes32 proofHash, bool valid) external {
        validProofs[proofHash] = valid;
    }

    function verifyProof(
        bytes32 vkey,
        bytes calldata publicValues,
        bytes calldata proofBytes
    ) external view override {
        bytes32 proofHash = keccak256(abi.encodePacked(vkey, publicValues, proofBytes));
        
        if (!alwaysValid) {
            require(validProofs[proofHash], "Invalid proof");
        }
        
        // In production, this would perform actual proof verification
        // For testing, we accept all proofs when alwaysValid is true
    }
}