//! Generate SP1 Verification Keys
//!
//! This script generates the verification keys for each proof type.

use clap::Parser;
use sp1_sdk::{include_elf, ProverClient, HashableKey};
use std::fs;
use std::path::Path;
use serde_json::json;

/// The ELF files for each proof circuit
pub const OWNERSHIP_PROOF_ELF: &[u8] = include_elf!("innocence-ownership-proof");
pub const BALANCE_PROOF_ELF: &[u8] = include_elf!("innocence-balance-proof");
pub const COMPLIANCE_PROOF_ELF: &[u8] = include_elf!("innocence-compliance-proof");
pub const TRADE_PROOF_ELF: &[u8] = include_elf!("innocence-trade-proof");

/// The arguments for the command
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(long, default_value = "./vkeys")]
    output_dir: String,
}

fn main() {
    // Setup the logger
    sp1_sdk::utils::setup_logger();
    dotenv::dotenv().ok();

    // Parse the command line arguments
    let args = Args::parse();

    // Create output directory if it doesn't exist
    fs::create_dir_all(&args.output_dir).expect("Failed to create output directory");

    // Setup the prover client
    let client = ProverClient::from_env();

    println!("=== Generating SP1 Verification Keys ===");

    // Generate vkeys for each proof type
    let proof_types = vec![
        ("ownership", OWNERSHIP_PROOF_ELF),
        ("balance", BALANCE_PROOF_ELF),
        ("compliance", COMPLIANCE_PROOF_ELF),
        ("trade", TRADE_PROOF_ELF),
    ];

    let mut vkeys = json!({});

    for (name, elf) in &proof_types {
        println!("\nGenerating {} verification key...", name);
        
        // Setup the program
        let (_, vk) = client.setup(elf);
        
        // Get the vkey bytes - bytes32() already returns a hex string
        let vkey_hex = vk.bytes32();
        
        vkeys[name] = json!({
            "vkey": vkey_hex,
            "programId": format!("0x{}", hex::encode(vk.hash_bytes())),
        });
        
        println!("✓ {} vkey: {}", name, vkey_hex);
    }

    // Write to JSON file
    let output_path = Path::new(&args.output_dir).join("verification_keys.json");
    fs::write(&output_path, serde_json::to_string_pretty(&vkeys).unwrap())
        .expect("Failed to write verification keys");
    
    println!("\n✓ All verification keys saved to: {}", output_path.display());
    
    // Also generate a Solidity file with the vkeys
    let mut sol_content = String::from("// SPDX-License-Identifier: MIT\n");
    sol_content.push_str("pragma solidity ^0.8.19;\n\n");
    sol_content.push_str("library InnocenceVerificationKeys {\n");
    
    for (name, _) in &proof_types {
        let vkey = &vkeys[name]["vkey"];
        sol_content.push_str(&format!(
            "    bytes32 public constant {}_VKEY = {};\n",
            name.to_uppercase(),
            vkey.as_str().unwrap()
        ));
    }
    
    sol_content.push_str("}\n");
    
    let sol_path = Path::new(&args.output_dir).join("InnocenceVerificationKeys.sol");
    fs::write(&sol_path, sol_content)
        .expect("Failed to write Solidity file");
    
    println!("✓ Solidity library saved to: {}", sol_path.display());
    
    println!("\nNext steps:");
    println!("1. Copy InnocenceVerificationKeys.sol to contracts directory");
    println!("2. Deploy SP1Verifier contract (or use existing deployment)");
    println!("3. Update HyperliquidPrivacySystem to use SP1 verifier");
}