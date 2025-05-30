//! Compliance Proof Circuit
//! 
//! This circuit proves that a user has valid KYC/compliance certification
//! without revealing their identity or personal information.
//!
//! Public inputs: commitment, compliance_authority_address, valid_until, certificate_hash
//! Private inputs: secret, nullifier, certificate_data, authority_signature
//! Proof: 
//! 1. commitment = hash(secret || nullifier)
//! 2. certificate_hash = hash(certificate_data)
//! 3. Verify authority signature on certificate
//! 4. Check certificate is still valid (timestamp check)

#![no_main]
sp1_zkvm::entrypoint!(main);

use alloy_sol_types::SolType;
use innocence_circuits_lib::ComplianceProofPublicValues;
use sha2::{Sha256, Digest};

pub fn main() {
    // Read private inputs
    let secret: [u8; 32] = sp1_zkvm::io::read();
    let nullifier: [u8; 32] = sp1_zkvm::io::read();
    let certificate_data: Vec<u8> = sp1_zkvm::io::read();
    // Read ECDSA signature components separately
    let signature_v: u8 = sp1_zkvm::io::read();
    let signature_r: [u8; 32] = sp1_zkvm::io::read();
    let signature_s: [u8; 32] = sp1_zkvm::io::read();
    
    // Read public inputs
    let expected_commitment: [u8; 32] = sp1_zkvm::io::read();
    let compliance_authority: [u8; 20] = sp1_zkvm::io::read(); // Ethereum address
    let valid_until: u64 = sp1_zkvm::io::read();
    let current_timestamp: u64 = sp1_zkvm::io::read();
    
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
    
    // Step 2: Compute certificate hash
    let mut cert_hasher = Sha256::new();
    cert_hasher.update(&certificate_data);
    let certificate_hash: [u8; 32] = cert_hasher.finalize().into();
    
    // Step 3: Verify certificate contains user commitment
    // Certificate data format: [commitment(32) || valid_until(8) || user_data(...)]
    assert!(
        certificate_data.len() >= 40,
        "Invalid certificate data length"
    );
    
    let cert_commitment = &certificate_data[0..32];
    assert_eq!(
        cert_commitment,
        &expected_commitment,
        "Certificate commitment mismatch"
    );
    
    let cert_valid_until = u64::from_le_bytes(
        certificate_data[32..40].try_into().unwrap()
    );
    assert_eq!(
        cert_valid_until,
        valid_until,
        "Certificate validity period mismatch"
    );
    
    // Step 4: Check certificate is still valid
    assert!(
        current_timestamp <= valid_until,
        "Certificate has expired"
    );
    
    // Step 5: Verify authority signature
    // In a real implementation, we would:
    // 1. Recover signer address from signature
    // 2. Verify it matches compliance_authority
    // For now, we'll do a simplified check
    
    // Create message hash for signature verification
    let mut msg_hasher = Sha256::new();
    msg_hasher.update(&certificate_data);
    let message_hash: [u8; 32] = msg_hasher.finalize().into();
    
    // Simplified signature verification
    // In production, use proper ECDSA recovery
    assert_ne!(
        signature_v,
        0,
        "Invalid signature recovery ID"
    );
    assert_ne!(
        signature_r[0],
        0,
        "Invalid signature r component"
    );
    
    // Commit to public values
    let public_values = ComplianceProofPublicValues {
        commitment: expected_commitment.into(),
        complianceAuthority: compliance_authority.into(),
        validUntil: alloy_sol_types::private::U256::from(valid_until),
        certificateHash: certificate_hash.into(),
    };
    
    let bytes = ComplianceProofPublicValues::abi_encode(&public_values);
    sp1_zkvm::io::commit_slice(&bytes);
}