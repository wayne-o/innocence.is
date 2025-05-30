//! Trade Proof Circuit
//! 
//! This circuit proves that a user can execute a valid trade without revealing
//! their actual balances. It ensures the user has sufficient balance for the trade
//! and that the trade parameters are valid.
//!
//! Public inputs: commitment, fromAsset, toAsset, fromAmount, minToAmount
//! Private inputs: secret, nullifier, fromBalance, toBalance
//! Proof: 
//! 1. commitment = hash(secret || nullifier)
//! 2. fromBalance >= fromAmount
//! 3. Trade parameters are valid (non-zero amounts, different assets)

#![no_main]
sp1_zkvm::entrypoint!(main);

use alloy_sol_types::SolType;
use innocence_circuits_lib::TradeProofPublicValues;
use sha2::{Sha256, Digest};

pub fn main() {
    // Read private inputs
    let secret: [u8; 32] = sp1_zkvm::io::read();
    let nullifier: [u8; 32] = sp1_zkvm::io::read();
    let from_balance: u64 = sp1_zkvm::io::read();
    let to_balance: u64 = sp1_zkvm::io::read();
    
    // Read public inputs
    let expected_commitment: [u8; 32] = sp1_zkvm::io::read();
    let from_asset: u64 = sp1_zkvm::io::read();
    let to_asset: u64 = sp1_zkvm::io::read();
    let from_amount: u64 = sp1_zkvm::io::read();
    let min_to_amount: u64 = sp1_zkvm::io::read();
    
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
    
    // Step 2: Verify sufficient balance for trade
    assert!(
        from_balance >= from_amount,
        "Insufficient balance for trade: {} < {}",
        from_balance,
        from_amount
    );
    
    // Step 3: Verify trade parameters
    assert!(
        from_amount > 0,
        "From amount must be greater than zero"
    );
    
    assert!(
        min_to_amount > 0,
        "Min to amount must be greater than zero"
    );
    
    assert_ne!(
        from_asset,
        to_asset,
        "Cannot trade same asset"
    );
    
    // Step 4: Additional validation
    // Ensure no overflow in balance calculations
    let new_from_balance = from_balance - from_amount;
    assert!(
        new_from_balance <= from_balance,
        "Balance underflow detected"
    );
    
    // In a real implementation, we would also verify:
    // - Price oracle data
    // - Slippage tolerance
    // - MEV protection parameters
    // - Cross-margin requirements for perps
    
    // Commit to public values
    let public_values = TradeProofPublicValues {
        commitment: expected_commitment.into(),
        fromAsset: from_asset,
        toAsset: to_asset,
        fromAmount: alloy_sol_types::private::U256::from(from_amount),
        minToAmount: alloy_sol_types::private::U256::from(min_to_amount),
    };
    
    let bytes = TradeProofPublicValues::abi_encode(&public_values);
    sp1_zkvm::io::commit_slice(&bytes);
}