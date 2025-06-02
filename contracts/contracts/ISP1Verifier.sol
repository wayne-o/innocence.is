// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ISP1Verifier {
    /// @notice Verifies a proof with the given verification key, public values, and proof bytes.
    /// @param vkey The verification key for the proof.
    /// @param publicValues The public values encoded as bytes.
    /// @param proofBytes The proof encoded as bytes.
    function verifyProof(
        bytes32 vkey,
        bytes calldata publicValues,
        bytes calldata proofBytes
    ) external view;
}