//! Innocence Protocol - Trade Proof Generator
//!
//! This script generates ZK proofs for private trading.

use alloy_sol_types::SolType;
use clap::Parser;
use hex;
use innocence_circuits_lib::{TradeProofPublicValues, compute_commitment};
use sp1_sdk::{include_elf, ProverClient, SP1Stdin, HashableKey};
use serde_json;

/// The ELF file for the trade proof circuit
pub const TRADE_PROOF_ELF: &[u8] = include_elf!("innocence-trade-proof");

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
    from_balance: Option<u64>,
    
    #[arg(long)]
    to_balance: Option<u64>,
    
    #[arg(long)]
    from_asset: Option<u64>,
    
    #[arg(long)]
    to_asset: Option<u64>,
    
    #[arg(long)]
    from_amount: Option<u64>,
    
    #[arg(long)]
    min_to_amount: Option<u64>,
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

    // Trade parameters
    let from_balance = args.from_balance.unwrap_or(10_000); // 10k USDC
    let to_balance = args.to_balance.unwrap_or(0); // 0 ETH
    let from_asset = args.from_asset.unwrap_or(0); // USDC
    let to_asset = args.to_asset.unwrap_or(1); // ETH
    let from_amount = args.from_amount.unwrap_or(1_000); // Trade 1k USDC
    let min_to_amount = args.min_to_amount.unwrap_or(500); // Expect at least 0.5 ETH

    // Compute commitment
    let commitment = compute_commitment(&secret, &nullifier);

    // Setup the prover client
    // Use local proving (no network access needed)
    let client = ProverClient::from_env();

    // Setup the inputs
    let mut stdin = SP1Stdin::new();
    stdin.write(&secret);
    stdin.write(&nullifier);
    stdin.write(&from_balance);
    stdin.write(&to_balance);
    stdin.write(&commitment);
    stdin.write(&from_asset);
    stdin.write(&to_asset);
    stdin.write(&from_amount);
    stdin.write(&min_to_amount);

    println!("=== Trade Proof Generation ===");
    println!("Commitment: 0x{}", hex::encode(commitment));
    println!("From Asset: {} Balance: {}", from_asset, from_balance);
    println!("To Asset: {} Balance: {}", to_asset, to_balance);
    println!("Trade Amount: {} -> Min: {}", from_amount, min_to_amount);

    if args.execute {
        // Execute the program
        let (output, report) = client.execute(TRADE_PROOF_ELF, &stdin).run().unwrap();
        println!("\nProgram executed successfully!");

        // Read the output
        let decoded = TradeProofPublicValues::abi_decode(output.as_slice()).unwrap();
        println!("\nPublic outputs:");
        println!("  Commitment: 0x{}", hex::encode(decoded.commitment));
        println!("  From Asset: {}", decoded.fromAsset);
        println!("  To Asset: {}", decoded.toAsset);
        println!("  From Amount: {}", decoded.fromAmount);
        println!("  Min To Amount: {}", decoded.minToAmount);

        // Record the number of cycles executed
        println!("\nNumber of cycles: {}", report.total_instruction_count());
    } else {
        // Setup the program for proving
        println!("\nSetting up proving keys...");
        let (pk, vk) = client.setup(TRADE_PROOF_ELF);

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
        let proof_path = "trade_proof.json";
        std::fs::write(proof_path, serde_json::to_string_pretty(&proof_json).unwrap())
            .expect("Failed to write proof");
        println!("✓ Proof saved to: {}", proof_path);
    }
}