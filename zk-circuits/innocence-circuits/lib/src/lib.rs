//! Innocence Protocol ZK Circuit Library
//! 
//! Common types and utilities for all Innocence ZK circuits

use alloy_sol_types::sol;

// Ownership proof public values
sol! {
    struct OwnershipProofPublicValues {
        bytes32 commitment;
        bytes32 nullifierHash;
    }
}

// Balance proof public values
sol! {
    struct BalanceProofPublicValues {
        bytes32 commitment;
        bytes32 merkleRoot;
        uint256 minBalance;
        uint64 assetId;
    }
}

// Trade proof public values
sol! {
    struct TradeProofPublicValues {
        bytes32 commitment;
        uint64 fromAsset;
        uint64 toAsset;
        uint256 fromAmount;
        uint256 minToAmount;
    }
}

// Compliance proof public values (DEPRECATED - use InnocenceProof instead)
sol! {
    struct ComplianceProofPublicValues {
        bytes32 commitment;
        address complianceAuthority;
        uint256 validUntil;
        bytes32 certificateHash;
    }
}

// Innocence proof public values - proves address is not sanctioned
sol! {
    struct InnocenceProofPublicValues {
        address depositor;
        bytes32 sanctionsRoot;
        uint256 timestamp;
        bool isInnocent;
    }
}

// Helper functions for commitment generation
pub fn compute_commitment(secret: &[u8; 32], nullifier: &[u8; 32]) -> [u8; 32] {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(secret);
    hasher.update(nullifier);
    hasher.finalize().into()
}

pub fn compute_nullifier_hash(nullifier: &[u8; 32]) -> [u8; 32] {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(nullifier);
    hasher.finalize().into()
}

// Merkle tree helpers
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MerkleProof {
    pub leaf: [u8; 32],
    pub path: Vec<[u8; 32]>,
    pub indices: Vec<bool>, // false = left, true = right
}

impl MerkleProof {
    pub fn verify(&self, root: &[u8; 32]) -> bool {
        use sha2::{Sha256, Digest};
        
        let mut current = self.leaf;
        
        for (i, sibling) in self.path.iter().enumerate() {
            let mut hasher = Sha256::new();
            
            if self.indices[i] {
                // Current node is on the right
                hasher.update(sibling);
                hasher.update(&current);
            } else {
                // Current node is on the left
                hasher.update(&current);
                hasher.update(sibling);
            }
            
            current = hasher.finalize().into();
        }
        
        &current == root
    }
}