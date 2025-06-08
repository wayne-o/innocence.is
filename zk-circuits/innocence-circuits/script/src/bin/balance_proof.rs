//! Innocence Protocol - Balance Proof Generator
//!
//! This script generates ZK proofs for balance verification with merkle tree inclusion.

use alloy_sol_types::SolType;
use clap::Parser;
use hex;
use innocence_circuits_lib::{BalanceProofPublicValues, MerkleProof, compute_commitment};
use sp1_sdk::{include_elf, ProverClient, SP1Stdin, HashableKey};
use sha2::{Sha256, Digest};
use serde_json;

/// The ELF file for the balance proof circuit
pub const BALANCE_PROOF_ELF: &[u8] = include_elf!("innocence-balance-proof");

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
    balance: Option<u64>,
    
    #[arg(long)]
    min_balance: Option<u64>,
    
    #[arg(long)]
    asset_id: Option<u64>,
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

    let actual_balance = args.balance.unwrap_or(1000);
    let min_balance = args.min_balance.unwrap_or(100);
    let asset_id = args.asset_id.unwrap_or(0); // USDC

    // Compute commitment
    let commitment = compute_commitment(&secret, &nullifier);
    
    // Create a simple merkle tree with our leaf
    let mut leaf_hasher = Sha256::new();
    leaf_hasher.update(&commitment);
    leaf_hasher.update(&asset_id.to_le_bytes());
    leaf_hasher.update(&actual_balance.to_le_bytes());
    let leaf: [u8; 32] = leaf_hasher.finalize().into();
    
    // For this example, create a simple merkle tree with 4 leaves
    let dummy_leaf = [0u8; 32];
    
    // Build merkle tree (our leaf at position 0)
    let mut hasher = Sha256::new();
    hasher.update(&leaf);
    hasher.update(&dummy_leaf);
    let left_parent: [u8; 32] = hasher.finalize().into();
    
    let mut hasher = Sha256::new();
    hasher.update(&dummy_leaf);
    hasher.update(&dummy_leaf);
    let right_parent: [u8; 32] = hasher.finalize().into();
    
    let mut hasher = Sha256::new();
    hasher.update(&left_parent);
    hasher.update(&right_parent);
    let merkle_root: [u8; 32] = hasher.finalize().into();
    
    // Create merkle proof (path from leaf to root)
    let merkle_proof = MerkleProof {
        leaf,
        path: vec![dummy_leaf, right_parent],
        indices: vec![false, false], // left, left
    };

    // Setup the prover client
    // Use local proving (no network access needed)
    let client = ProverClient::from_env();

    // Setup the inputs
    let mut stdin = SP1Stdin::new();
    stdin.write(&secret);
    stdin.write(&nullifier);
    stdin.write(&actual_balance);
    // Write merkle proof components
    stdin.write(&merkle_proof.leaf);
    stdin.write(&merkle_proof.path.len());
    for node in &merkle_proof.path {
        stdin.write(node);
    }
    for idx in &merkle_proof.indices {
        stdin.write(idx);
    }
    stdin.write(&commitment);
    stdin.write(&merkle_root);
    stdin.write(&min_balance);
    stdin.write(&asset_id);

    println!("=== Balance Proof Generation ===");
    println!("Commitment: 0x{}", hex::encode(commitment));
    println!("Asset ID: {}", asset_id);
    println!("Actual Balance: {}", actual_balance);
    println!("Min Balance: {}", min_balance);
    println!("Merkle Root: 0x{}", hex::encode(merkle_root));

    if args.execute {
        // Execute the program
        let (output, report) = client.execute(BALANCE_PROOF_ELF, &stdin).run().unwrap();
        println!("\nProgram executed successfully!");

        // Read the output
        let decoded = BalanceProofPublicValues::abi_decode(output.as_slice()).unwrap();
        println!("\nPublic outputs:");
        println!("  Commitment: 0x{}", hex::encode(decoded.commitment));
        println!("  Merkle Root: 0x{}", hex::encode(decoded.merkleRoot));
        println!("  Min Balance: {}", decoded.minBalance);
        println!("  Asset ID: {}", decoded.assetId);

        // Record the number of cycles executed
        println!("\nNumber of cycles: {}", report.total_instruction_count());
    } else {
        // Setup the program for proving
        println!("\nSetting up proving keys...");
        let (pk, vk) = client.setup(BALANCE_PROOF_ELF);

        // Generate the proof
        let use_groth16 = std::env::var("USE_GROTH16").unwrap_or_else(|_| "false".to_string()) == "true";
        
        let proof = if use_groth16 {
            println!("Generating Groth16 proof...");
            client
                .prove(&pk, &stdin)
                .groth16()
                .run()
                .expect("failed to generate proof")
        } else {
            println!("Generating Core proof...");
            client
                .prove(&pk, &stdin)
                .run()
                .expect("failed to generate proof")
        };

        println!("✓ Successfully generated {} proof!", if use_groth16 { "Groth16" } else { "Core" });

        // Verify the proof
        client.verify(&proof, &vk).expect("failed to verify proof");
        println!("✓ Successfully verified proof!");

        // Get the raw proof bytes for the verifier (if supported)
        let proof_bytes = if use_groth16 {
            proof.bytes()
        } else {
            // For Core proofs, we'll use a placeholder
            // In production, you must use Groth16 or PLONK for on-chain verification
            vec![0u8; 32]
        };
        println!("Proof bytes (for verifier): 0x{}", hex::encode(&proof_bytes));

        // Create proof JSON with both SP1 proof format and raw bytes
        let proof_json = serde_json::json!({
            "proof": proof,
            "rawBytes": format!("0x{}", hex::encode(&proof_bytes)),
            "publicValues": format!("0x{}", hex::encode(&proof.public_values.as_slice())),
            "vkey": format!("0x{}", hex::encode(&vk.bytes32()))
        });

        // Save the proof to a file
        let proof_path = "balance_proof.json";
        std::fs::write(proof_path, serde_json::to_string_pretty(&proof_json).unwrap())
            .expect("Failed to write proof");
        println!("✓ Proof saved to: {}", proof_path);
    }
}