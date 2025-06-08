//! Innocence Protocol - Innocence Proof Generator
//!
//! This script generates ZK proofs that an address is NOT on the sanctions list

use alloy_sol_types::SolType;
use clap::Parser;
use hex;
use sp1_sdk::{include_elf, ProverClient, SP1Stdin, HashableKey};
use serde_json;

/// The ELF file for the innocence proof circuit
pub const INNOCENCE_PROOF_ELF: &[u8] = include_elf!("innocence-proof");

/// The arguments for the command
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(long)]
    execute: bool,

    #[arg(long)]
    prove: bool,

    #[arg(long)]
    depositor: Option<String>, // Ethereum address to check
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

    // Get depositor address
    let depositor_str = args.depositor.unwrap_or_else(|| {
        "0x5Bd2F329C50860366c0E6D3b4227a422B66AD203".to_string() // Default test address
    });
    
    let depositor_bytes = hex::decode(depositor_str.trim_start_matches("0x"))
        .expect("Invalid depositor address");
    let mut depositor = [0u8; 20];
    depositor.copy_from_slice(&depositor_bytes);

    // Mock sanctions root (in production, this would come from an oracle)
    let sanctions_root = [0u8; 32]; // Empty root for now
    
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    // Setup the prover client
    // Use local proving (no network access needed)
    let client = ProverClient::from_env();

    // Setup the inputs
    let mut stdin = SP1Stdin::new();
    stdin.write(&depositor);
    stdin.write(&sanctions_root);
    stdin.write(&timestamp);

    println!("=== Innocence Proof Generation ===");
    println!("Depositor: 0x{}", hex::encode(depositor));
    println!("Sanctions Root: 0x{}", hex::encode(sanctions_root));
    println!("Timestamp: {}", timestamp);

    if args.execute {
        // Execute the program
        let (output, report) = client.execute(INNOCENCE_PROOF_ELF, &stdin).run().unwrap();
        println!("\nProgram executed successfully!");

        // Read the output (depositor, sanctions_root, timestamp, is_innocent)
        let output_bytes = output.as_slice();
        let is_innocent = output_bytes[output_bytes.len() - 1] != 0;
        
        println!("\nResult: Address is {}", if is_innocent { "INNOCENT ✅" } else { "SANCTIONED ❌" });
        println!("Number of cycles: {}", report.total_instruction_count());
    } else {
        // Setup the program for proving
        println!("\nSetting up proving keys...");
        let (pk, vk) = client.setup(INNOCENCE_PROOF_ELF);

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
            "vkey": format!("0x{}", hex::encode(&vk.bytes32())),
            "depositor": format!("0x{}", hex::encode(&depositor))
        });

        // Save the proof to a file
        let proof_path = "innocence_proof.json";
        std::fs::write(proof_path, serde_json::to_string_pretty(&proof_json).unwrap())
            .expect("Failed to write proof");
        println!("✓ Proof saved to: {}", proof_path);
    }
}