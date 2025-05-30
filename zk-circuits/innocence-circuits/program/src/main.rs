//! Ownership Proof Circuit
//! 
//! This circuit proves that a user knows the secret and nullifier that correspond
//! to a commitment without revealing either value.
//!
//! Public inputs: commitment
//! Private inputs: secret, nullifier
//! Proof: commitment = hash(secret || nullifier)

#![no_main]
sp1_zkvm::entrypoint!(main);

use alloy_sol_types::SolType;
use innocence_circuits_lib::OwnershipProofPublicValues;
use sha2::{Sha256, Digest};

pub fn main() {
    // Read private inputs from the prover
    let secret: [u8; 32] = sp1_zkvm::io::read();
    let nullifier: [u8; 32] = sp1_zkvm::io::read();
    
    // Read the expected commitment (public input)
    let expected_commitment: [u8; 32] = sp1_zkvm::io::read();
    
    // Compute commitment = hash(secret || nullifier)
    let mut hasher = Sha256::new();
    hasher.update(&secret);
    hasher.update(&nullifier);
    let computed_commitment: [u8; 32] = hasher.finalize().into();
    
    // Verify the commitment matches
    assert_eq!(
        computed_commitment, 
        expected_commitment, 
        "Invalid commitment: computed does not match expected"
    );
    
    // Compute nullifier hash (this will be revealed to prevent double spending)
    let mut nullifier_hasher = Sha256::new();
    nullifier_hasher.update(&nullifier);
    let nullifier_hash: [u8; 32] = nullifier_hasher.finalize().into();
    
    // Commit to public values
    let public_values = OwnershipProofPublicValues {
        commitment: expected_commitment.into(),
        nullifierHash: nullifier_hash.into(),
    };
    
    let bytes = OwnershipProofPublicValues::abi_encode(&public_values);
    sp1_zkvm::io::commit_slice(&bytes);
}