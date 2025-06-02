// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./HyperliquidPrivacySystemV5.sol";

/// @notice Debug version that logs more info and optionally skips sendSpot
contract HyperliquidPrivacySystemV5Debug is HyperliquidPrivacySystemV5 {
    
    event DebugWithdrawStep(string step, bytes32 nullifier, uint64 amount);
    event DebugSendSpotCall(address recipient, uint64 token, uint64 amount);
    
    constructor(
        address _sp1Verifier,
        address _complianceAuthority
    ) HyperliquidPrivacySystemV5(_sp1Verifier, _complianceAuthority) {}
    
    /// @notice Debug withdrawal with detailed logging
    function debugWithdraw(
        bytes32 nullifier,
        address recipient,
        uint64 token,
        uint64 amount,
        bytes calldata balanceProof,
        bytes calldata publicValues,
        bool skipSendSpot
    ) external {
        emit DebugWithdrawStep("start", nullifier, amount);
        
        require(!nullifiers[nullifier], "Nullifier already used");
        emit DebugWithdrawStep("nullifier_check_passed", nullifier, amount);
        
        // Decode and verify balance proof
        BalanceProofPublicValues memory balance = abi.decode(publicValues, (BalanceProofPublicValues));
        emit DebugWithdrawStep("decoded_public_values", nullifier, amount);
        
        require(balance.merkleRoot == getMerkleRoot(), "Invalid merkle root");
        emit DebugWithdrawStep("merkle_root_check_passed", nullifier, amount);
        
        require(balance.minBalance >= amount, "Insufficient proven balance");
        emit DebugWithdrawStep("balance_check_passed", nullifier, amount);
        
        require(balance.assetId == token, "Asset mismatch");
        emit DebugWithdrawStep("asset_check_passed", nullifier, amount);
        
        // Verify the ZK proof
        sp1Verifier.verifyProof(
            InnocenceVerificationKeys.BALANCE_VKEY,
            publicValues,
            balanceProof
        );
        emit DebugWithdrawStep("proof_verification_passed", nullifier, amount);
        
        nullifiers[nullifier] = true;
        emit DebugWithdrawStep("nullifier_marked_used", nullifier, amount);
        
        if (!skipSendSpot) {
            emit DebugSendSpotCall(recipient, token, amount);
            // This is where it might be failing
            HYPERCORE_WRITE.sendSpot(recipient, token, amount);
            emit DebugWithdrawStep("sendspot_completed", nullifier, amount);
        } else {
            emit DebugWithdrawStep("sendspot_skipped", nullifier, amount);
        }
        
        emit PrivateWithdraw(nullifier, block.timestamp);
        emit DebugWithdrawStep("completed", nullifier, amount);
    }
}