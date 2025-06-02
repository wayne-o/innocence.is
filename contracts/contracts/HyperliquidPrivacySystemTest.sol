// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./HyperliquidPrivacySystemV5.sol";

/// @notice Test version of the privacy system without HyperCore sendSpot calls
/// @dev This allows us to test the ZK proof verification without actual token transfers
contract HyperliquidPrivacySystemTest is HyperliquidPrivacySystemV5 {
    
    event TestWithdraw(bytes32 indexed nullifier, address recipient, uint64 token, uint64 amount, uint256 timestamp);
    
    constructor(
        address _sp1Verifier,
        address _complianceAuthority
    ) HyperliquidPrivacySystemV5(_sp1Verifier, _complianceAuthority) {}
    
    /// @notice Test withdrawal that doesn't actually transfer tokens
    /// @dev All the same validation as regular withdrawal, but skips the sendSpot call
    function testWithdraw(
        bytes32 nullifier,
        address recipient,
        uint64 token,
        uint64 amount,
        bytes calldata balanceProof,
        bytes calldata publicValues
    ) external {
        require(!nullifiers[nullifier], "Nullifier already used");
        
        // Decode and verify balance proof
        BalanceProofPublicValues memory balance = abi.decode(publicValues, (BalanceProofPublicValues));
        require(balance.merkleRoot == getMerkleRoot(), "Invalid merkle root");
        require(balance.minBalance >= amount, "Insufficient proven balance");
        require(balance.assetId == token, "Asset mismatch");
        
        // Verify the ZK proof
        sp1Verifier.verifyProof(
            InnocenceVerificationKeys.BALANCE_VKEY,
            publicValues,
            balanceProof
        );
        
        nullifiers[nullifier] = true;
        
        // Skip the actual token transfer for testing
        // HYPERCORE_WRITE.sendSpot(recipient, token, amount);
        
        emit TestWithdraw(nullifier, recipient, token, amount, block.timestamp);
    }
}