//! Balance Proof Circuit
//! 
//! This circuit proves that a user has sufficient balance for a withdrawal/trade
//! without revealing the actual balance. It also proves membership in a merkle tree.
//!
//! Public inputs: commitment, merkle_root, min_balance, asset_id
//! Private inputs: secret, nullifier, actual_balance, merkle_proof
//! Proof: 
//! 1. commitment = hash(secret || nullifier)
//! 2. actual_balance >= min_balance
//! 3. leaf = hash(commitment || asset_id || actual_balance) is in merkle tree

#![no_main]
sp1_zkvm::entrypoint!(main);

use alloy_sol_types::SolType;
use innocence_circuits_lib::BalanceProofPublicValues;
use sha2::{Sha256, Digest};

pub fn main() {
    // Read private inputs
    let secret: [u8; 32] = sp1_zkvm::io::read();
    let nullifier: [u8; 32] = sp1_zkvm::io::read();
    let actual_balance: u64 = sp1_zkvm::io::read();
    // Read merkle proof components
    let merkle_leaf: [u8; 32] = sp1_zkvm::io::read();
    let merkle_path_len: usize = sp1_zkvm::io::read();
    let mut merkle_path: Vec<[u8; 32]> = Vec::with_capacity(merkle_path_len);
    for _ in 0..merkle_path_len {
        merkle_path.push(sp1_zkvm::io::read());
    }
    let mut merkle_indices: Vec<bool> = Vec::with_capacity(merkle_path_len);
    for _ in 0..merkle_path_len {
        merkle_indices.push(sp1_zkvm::io::read());
    }
    
    // Read public inputs
    let expected_commitment: [u8; 32] = sp1_zkvm::io::read();
    let merkle_root: [u8; 32] = sp1_zkvm::io::read();
    let min_balance: u64 = sp1_zkvm::io::read();
    let asset_id: u64 = sp1_zkvm::io::read();
    
    // Step 1: Verify commitment
    let mut hasher = Sha256::new();
    hasher.update(&secret);
    hasher.update(&nullifier);
    let computed_commitment: [u8; 32] = hasher.finalize().into();
    
    assert_eq!(
        computed_commitment, 
        expected_commitment, 
        "Invalid commitment"
    );
    
    // Step 2: Verify balance is sufficient
    assert!(
        actual_balance >= min_balance,
        "Insufficient balance: {} < {}",
        actual_balance,
        min_balance
    );
    
    // Step 3: Compute leaf hash
    let mut leaf_hasher = Sha256::new();
    leaf_hasher.update(&expected_commitment);
    leaf_hasher.update(&asset_id.to_le_bytes());
    leaf_hasher.update(&actual_balance.to_le_bytes());
    let leaf: [u8; 32] = leaf_hasher.finalize().into();
    
    // Step 4: Verify merkle proof
    assert_eq!(
        merkle_leaf, 
        leaf,
        "Merkle proof leaf does not match computed leaf"
    );
    
    // Verify merkle proof manually
    let mut current = merkle_leaf;
    for i in 0..merkle_path_len {
        let mut hasher = Sha256::new();
        if merkle_indices[i] {
            // Current node is on the right
            hasher.update(&merkle_path[i]);
            hasher.update(&current);
        } else {
            // Current node is on the left
            hasher.update(&current);
            hasher.update(&merkle_path[i]);
        }
        current = hasher.finalize().into();
    }
    
    assert_eq!(
        current,
        merkle_root,
        "Invalid merkle proof"
    );
    
    // Commit to public values
    let public_values = BalanceProofPublicValues {
        commitment: expected_commitment.into(),
        merkleRoot: merkle_root.into(),
        minBalance: alloy_sol_types::private::U256::from(min_balance),
        assetId: asset_id,
    };
    
    let bytes = BalanceProofPublicValues::abi_encode(&public_values);
    sp1_zkvm::io::commit_slice(&bytes);
}