//! Innocence Protocol - Ownership Proof Generator
//!
//! This script generates ZK proofs for ownership of commitments in the Innocence Protocol.
//!
//! You can run this script using the following command:
//! ```shell
//! RUST_LOG=info cargo run --release -- --execute
//! ```
//! or
//! ```shell
//! RUST_LOG=info cargo run --release -- --prove
//! ```

use alloy_sol_types::SolType;
use clap::Parser;
use hex;
use innocence_circuits_lib::{OwnershipProofPublicValues, compute_commitment, compute_nullifier_hash};
use sp1_sdk::{include_elf, ProverClient, SP1Stdin};

/// The ELF file for the ownership proof circuit
pub const OWNERSHIP_PROOF_ELF: &[u8] = include_elf!("innocence-ownership-proof");

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
    commitment: Option<String>,
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

    // Setup test data or use provided values
    let secret = if let Some(s) = args.secret {
        let bytes = hex::decode(s.trim_start_matches("0x")).expect("Invalid secret hex");
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        arr
    } else {
        // Test secret
        [1u8; 32]
    };

    let nullifier = if let Some(n) = args.nullifier {
        let bytes = hex::decode(n.trim_start_matches("0x")).expect("Invalid nullifier hex");
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        arr
    } else {
        // Test nullifier
        [2u8; 32]
    };

    // Compute expected commitment
    let expected_commitment = compute_commitment(&secret, &nullifier);
    
    // Verify if provided commitment matches
    if let Some(c) = args.commitment {
        let bytes = hex::decode(c.trim_start_matches("0x")).expect("Invalid commitment hex");
        let mut provided_commitment = [0u8; 32];
        provided_commitment.copy_from_slice(&bytes);
        
        if provided_commitment != expected_commitment {
            eprintln!("Error: Provided commitment does not match computed commitment");
            eprintln!("Computed: 0x{}", hex::encode(expected_commitment));
            eprintln!("Provided: 0x{}", hex::encode(provided_commitment));
            std::process::exit(1);
        }
    }

    // Setup the prover client
    let client = ProverClient::from_env();

    // Setup the inputs
    let mut stdin = SP1Stdin::new();
    stdin.write(&secret);
    stdin.write(&nullifier);
    stdin.write(&expected_commitment);

    println!("=== Ownership Proof Generation ===");
    println!("Commitment: 0x{}", hex::encode(expected_commitment));

    if args.execute {
        // Execute the program
        let (output, report) = client.execute(OWNERSHIP_PROOF_ELF, &stdin).run().unwrap();
        println!("Program executed successfully.");

        // Read the output
        let decoded = OwnershipProofPublicValues::abi_decode(output.as_slice()).unwrap();
        println!("Public outputs:");
        println!("  Commitment: 0x{}", hex::encode(decoded.commitment));
        println!("  Nullifier Hash: 0x{}", hex::encode(decoded.nullifierHash));

        // Verify the outputs
        let expected_nullifier_hash = compute_nullifier_hash(&nullifier);
        let nullifier_hash_bytes: &[u8; 32] = decoded.nullifierHash.as_ref();
        assert_eq!(nullifier_hash_bytes, &expected_nullifier_hash);
        println!("✓ Nullifier hash is correct!");

        // Record the number of cycles executed
        println!("Number of cycles: {}", report.total_instruction_count());
    } else {
        // Setup the program for proving
        println!("Setting up proving keys...");
        let (pk, vk) = client.setup(OWNERSHIP_PROOF_ELF);

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
        let proof_path = "ownership_proof.json";
        std::fs::write(proof_path, serde_json::to_string_pretty(&proof).unwrap())
            .expect("Failed to write proof");
        println!("✓ Proof saved to: {}", proof_path);

        // Extract and display public values
        let public_values = proof.public_values.as_slice();
        let decoded = OwnershipProofPublicValues::abi_decode(public_values).unwrap();
        println!("\nPublic outputs:");
        println!("  Commitment: 0x{}", hex::encode(decoded.commitment));
        println!("  Nullifier Hash: 0x{}", hex::encode(decoded.nullifierHash));
    }
}