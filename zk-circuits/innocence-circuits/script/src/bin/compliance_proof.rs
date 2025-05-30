//! Innocence Protocol - Compliance Proof Generator
//!
//! This script generates ZK proofs for compliance verification.

use alloy_sol_types::SolType;
use clap::Parser;
use hex;
use innocence_circuits_lib::{ComplianceProofPublicValues, compute_commitment};
use sp1_sdk::{include_elf, ProverClient, SP1Stdin};
use sha2::{Sha256, Digest};

/// The ELF file for the compliance proof circuit
pub const COMPLIANCE_PROOF_ELF: &[u8] = include_elf!("innocence-compliance-proof");

/// The arguments for the command
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(long)]
    execute: bool,

    #[arg(long)]
    prove: bool,

    #[arg(long)]
    secret: Option<String>,

    #[arg(long)]
    nullifier: Option<String>,
    
    #[arg(long)]
    valid_days: Option<u64>,
}

fn main() {
    // Setup the logger
    sp1_sdk::utils::setup_logger();
    dotenv::dotenv().ok();

    // Parse the command line arguments
    let args = Args::parse();

    if args.execute == args.prove {
        eprintln!("Error: You must specify either --execute or --prove");
        std::process::exit(1);
    }

    // Setup test data
    let secret = if let Some(s) = args.secret {
        let bytes = hex::decode(s.trim_start_matches("0x")).expect("Invalid secret hex");
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        arr
    } else {
        [1u8; 32]
    };

    let nullifier = if let Some(n) = args.nullifier {
        let bytes = hex::decode(n.trim_start_matches("0x")).expect("Invalid nullifier hex");
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        arr
    } else {
        [2u8; 32]
    };

    // Compute commitment
    let commitment = compute_commitment(&secret, &nullifier);
    
    // Mock compliance authority (in production, this would be the real authority address)
    let compliance_authority = [0x5B, 0xd2, 0xF3, 0x29, 0xC5, 0x08, 0x60, 0x36, 0x6c, 0x0E, 
                                0x6D, 0x3b, 0x42, 0x27, 0xa4, 0x22, 0xB6, 0x6A, 0xD2, 0x03]; // Your address
    
    // Certificate validity
    let current_timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let valid_days = args.valid_days.unwrap_or(365);
    let valid_until = current_timestamp + (valid_days * 24 * 60 * 60);
    
    // Create certificate data
    let mut certificate_data = Vec::new();
    certificate_data.extend_from_slice(&commitment);
    certificate_data.extend_from_slice(&valid_until.to_le_bytes());
    certificate_data.extend_from_slice(b"USER_ID_12345"); // Mock user data
    
    // Create mock signature (in production, this would be a real ECDSA signature)
    let mut authority_signature = [0u8; 65];
    authority_signature[0] = 27; // Recovery ID
    authority_signature[1..33].copy_from_slice(&[1u8; 32]); // r
    authority_signature[33..65].copy_from_slice(&[2u8; 32]); // s

    // Setup the prover client
    let client = ProverClient::from_env();

    // Setup the inputs
    let mut stdin = SP1Stdin::new();
    stdin.write(&secret);
    stdin.write(&nullifier);
    stdin.write(&certificate_data);
    // Write signature components separately
    stdin.write(&authority_signature[0]); // v
    let r: [u8; 32] = authority_signature[1..33].try_into().unwrap();
    stdin.write(&r); // r
    let s: [u8; 32] = authority_signature[33..65].try_into().unwrap();
    stdin.write(&s); // s
    stdin.write(&commitment);
    stdin.write(&compliance_authority);
    stdin.write(&valid_until);
    stdin.write(&current_timestamp);

    // Compute certificate hash
    let mut cert_hasher = Sha256::new();
    cert_hasher.update(&certificate_data);
    let certificate_hash: [u8; 32] = cert_hasher.finalize().into();

    println!("=== Compliance Proof Generation ===");
    println!("Commitment: 0x{}", hex::encode(commitment));
    println!("Authority: 0x{}", hex::encode(compliance_authority));
    println!("Valid Until: {} ({})", valid_until, 
        chrono::DateTime::<chrono::Utc>::from_timestamp(valid_until as i64, 0)
            .unwrap()
            .format("%Y-%m-%d %H:%M:%S UTC"));
    println!("Certificate Hash: 0x{}", hex::encode(certificate_hash));

    if args.execute {
        // Execute the program
        let (output, report) = client.execute(COMPLIANCE_PROOF_ELF, &stdin).run().unwrap();
        println!("\nProgram executed successfully!");

        // Read the output
        let decoded = ComplianceProofPublicValues::abi_decode(output.as_slice()).unwrap();
        println!("\nPublic outputs:");
        println!("  Commitment: 0x{}", hex::encode(decoded.commitment));
        println!("  Authority: 0x{}", hex::encode(decoded.complianceAuthority));
        println!("  Valid Until: {}", decoded.validUntil);
        println!("  Certificate Hash: 0x{}", hex::encode(decoded.certificateHash));

        // Record the number of cycles executed
        println!("\nNumber of cycles: {}", report.total_instruction_count());
    } else {
        // Setup the program for proving
        println!("\nSetting up proving keys...");
        let (pk, vk) = client.setup(COMPLIANCE_PROOF_ELF);

        // Generate the proof
        println!("Generating proof...");
        let proof = client
            .prove(&pk, &stdin)
            .run()
            .expect("failed to generate proof");

        println!("✓ Successfully generated proof!");

        // Verify the proof
        client.verify(&proof, &vk).expect("failed to verify proof");
        println!("✓ Successfully verified proof!");

        // Save the proof to a file
        let proof_path = "compliance_proof.json";
        std::fs::write(proof_path, serde_json::to_string_pretty(&proof).unwrap())
            .expect("Failed to write proof");
        println!("✓ Proof saved to: {}", proof_path);
    }
}