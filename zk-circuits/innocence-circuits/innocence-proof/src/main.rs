//! Innocence Proof Circuit
//! 
//! This circuit proves that a depositor's address is NOT on a sanctions list.
//! This is much simpler than KYC - we just need to prove the address isn't sanctioned.
//!
//! Public inputs: depositor_address, sanctions_list_root, timestamp
//! Private inputs: merkle_proof showing address is NOT in sanctions tree
//! 
//! The approach:
//! 1. Maintain a Merkle tree of sanctioned addresses off-chain
//! 2. Prove that the depositor's address is NOT in this tree
//! 3. Or alternatively, prove membership in an "allowed addresses" tree

#![no_main]
sp1_zkvm::entrypoint!(main);

use alloy_sol_types::SolType;
use sha2::{Sha256, Digest};

#[derive(Default)]
struct InnocenceProofPublicValues {
    depositor: [u8; 20],        // Ethereum address of depositor
    sanctionsRoot: [u8; 32],    // Merkle root of sanctions list
    timestamp: u64,             // When this proof was generated
    isInnocent: bool,           // True if address is NOT sanctioned
}

pub fn main() {
    // Read inputs
    let depositor_address: [u8; 20] = sp1_zkvm::io::read();
    let sanctions_root: [u8; 32] = sp1_zkvm::io::read();
    let timestamp: u64 = sp1_zkvm::io::read();
    
    // For now, we'll use a simple approach:
    // Check if the address matches any known sanctioned addresses
    // In production, this would use a Merkle tree for efficiency
    
    // Example sanctioned addresses (OFAC list)
    let sanctioned_addresses: Vec<[u8; 20]> = vec![
        // Tornado Cash addresses
        hex_literal::hex!("8589427373D6D84E98730D7795D8f6f8731FDA16"),
        hex_literal::hex!("722122dF12D4e14e13Ac3b6895a86e84145b6967"),
        hex_literal::hex!("DD4c48C0B24039969fC16D1cdF626eaB821d3384"),
        // Add more sanctioned addresses here
    ];
    
    // Check if depositor is in sanctions list
    let is_sanctioned = sanctioned_addresses.iter()
        .any(|&addr| addr == depositor_address);
    
    // The depositor is innocent if NOT sanctioned
    let is_innocent = !is_sanctioned;
    
    // Commit to public values
    let public_values = InnocenceProofPublicValues {
        depositor: depositor_address,
        sanctionsRoot: sanctions_root,
        timestamp,
        isInnocent: is_innocent,
    };
    
    // For SP1, we need to serialize and commit the public values
    // This is simplified - in production you'd properly encode this
    sp1_zkvm::io::commit(&depositor_address);
    sp1_zkvm::io::commit(&sanctions_root);
    sp1_zkvm::io::commit(&timestamp);
    sp1_zkvm::io::commit(&is_innocent);
}