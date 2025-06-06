+++
date = '2025-06-06T16:35:40+02:00'
draft = false
title = 'Building a Decentralized Voting System with SP1 zkVM'
description = 'Learn how to build a privacy-preserving voting system using Succinct SP1 zkVM - making ZK development accessible to Rust developers.'
+++

## Introduction

Zero-knowledge proofs are revolutionizing how we think about privacy and verification in blockchain applications. Today, I'll walk you through building a decentralized voting system using Succinct's SP1 zkVM - a powerful tool that makes ZK development accessible to Rust developers.

## Why SP1 zkVM?

SP1 stands out in the ZK landscape for several reasons:
- **Rust-native development**: Write your circuits in familiar Rust
- **No cryptography expertise required**: Focus on your application logic
- **Production-ready**: Battle-tested with real deployments
- **Flexible proving options**: Local, cloud, or decentralized network

## What We're Building

We'll create a privacy-preserving voting system where:
- Voters can cast ballots without revealing their identity
- Each voter can only vote once
- Vote tallies are publicly verifiable
- The entire process is trustless

## Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install SP1
curl -L https://sp1up.succinct.xyz | bash
sp1up

# Verify installation
cargo prove --version
```

## Project Structure

```
zk-voting/
├── voting-program/     # The zkVM program
│   ├── Cargo.toml
│   └── src/
│       └── main.rs
├── script/            # Proof generation scripts
│   ├── Cargo.toml
│   └── src/
│       └── main.rs
└── contracts/         # Smart contracts
    └── VotingVerifier.sol
```

## Step 1: The Voting Circuit

Create `voting-program/src/main.rs`:

```rust
#![no_main]
sp1_zkvm::entrypoint!(main);

use sp1_zkvm::prelude::*;

pub struct VoteInput {
    voter_secret: [u8; 32],
    voter_nullifier: [u8; 32],
    candidate_id: u32,
    merkle_proof: Vec<[u8; 32]>,
    merkle_root: [u8; 32],
}

pub fn main() {
    // Read private inputs
    let input = sp1_zkvm::io::read::<VoteInput>();
    
    // Verify voter is eligible (in merkle tree)
    let voter_leaf = hash_voter(
        &input.voter_secret, 
        &input.voter_nullifier
    );
    
    let computed_root = compute_merkle_root(
        voter_leaf,
        &input.merkle_proof
    );
    
    assert_eq!(
        computed_root, 
        input.merkle_root,
        "Voter not in eligible list"
    );
    
    // Compute nullifier to prevent double voting
    let nullifier = compute_nullifier(&input.voter_nullifier);
    
    // Commit public outputs
    sp1_zkvm::io::commit(&nullifier);
    sp1_zkvm::io::commit(&input.candidate_id);
    sp1_zkvm::io::commit(&input.merkle_root);
}

fn hash_voter(secret: &[u8; 32], nullifier: &[u8; 32]) -> [u8; 32] {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(secret);
    hasher.update(nullifier);
    hasher.finalize().into()
}

fn compute_nullifier(nullifier: &[u8; 32]) -> [u8; 32] {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(b"nullifier");
    hasher.update(nullifier);
    hasher.finalize().into()
}

fn compute_merkle_root(
    leaf: [u8; 32], 
    proof: &[[u8; 32]]
) -> [u8; 32] {
    use sha2::{Sha256, Digest};
    
    let mut current = leaf;
    for sibling in proof {
        let mut hasher = Sha256::new();
        // Sort to ensure consistent ordering
        if current < *sibling {
            hasher.update(&current);
            hasher.update(sibling);
        } else {
            hasher.update(sibling);
            hasher.update(&current);
        }
        current = hasher.finalize().into();
    }
    current
}
```

## Step 2: The Proof Generator

Create `script/src/main.rs`:

```rust
use sp1_sdk::{ProverClient, SP1Stdin};
use clap::Parser;

#[derive(Parser)]
struct Args {
    #[arg(long)]
    voter_secret: String,
    #[arg(long)]
    voter_nullifier: String,
    #[arg(long)]
    candidate_id: u32,
    #[arg(long)]
    use_network: bool,
}

const VOTING_ELF: &[u8] = include_bytes!("../../voting-program/target/elf");

fn main() {
    sp1_sdk::utils::setup_logger();
    let args = Args::parse();
    
    // Initialize prover client
    let client = if args.use_network {
        ProverClient::network()
    } else {
        ProverClient::from_env()
    };
    
    // Prepare inputs
    let mut stdin = SP1Stdin::new();
    
    // In production, these would come from a secure source
    let vote_input = VoteInput {
        voter_secret: hex::decode(&args.voter_secret).unwrap().try_into().unwrap(),
        voter_nullifier: hex::decode(&args.voter_nullifier).unwrap().try_into().unwrap(),
        candidate_id: args.candidate_id,
        merkle_proof: generate_mock_proof(),
        merkle_root: get_eligible_voters_root(),
    };
    
    stdin.write(&vote_input);
    
    // Generate proof
    println!("Generating voting proof...");
    let (pk, vk) = client.setup(VOTING_ELF);
    
    let proof = if std::env::var("USE_GROTH16").unwrap_or_default() == "true" {
        println!("Using Groth16 for on-chain verification...");
        client.prove(&pk, &stdin).groth16().run().unwrap()
    } else {
        println!("Using standard proving...");
        client.prove(&pk, &stdin).run().unwrap()
    };
    
    println!("Proof generated successfully!");
    println!("Nullifier: 0x{}", hex::encode(&proof.public_values[0..32]));
    println!("Candidate: {}", u32::from_le_bytes(proof.public_values[32..36].try_into().unwrap()));
    
    // Save proof for contract submission
    save_proof_for_contract(&proof);
}
```

## Step 3: The Smart Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ISP1Verifier} from "@sp1-contracts/ISP1Verifier.sol";

contract DecentralizedVoting {
    ISP1Verifier public immutable verifier;
    bytes32 public immutable votingProgramVkey;
    bytes32 public immutable eligibleVotersRoot;
    
    mapping(bytes32 => bool) public nullifierUsed;
    mapping(uint32 => uint256) public voteCounts;
    
    event VoteCast(bytes32 indexed nullifier, uint32 candidate);
    
    constructor(
        address _verifier,
        bytes32 _vkey,
        bytes32 _votersRoot
    ) {
        verifier = ISP1Verifier(_verifier);
        votingProgramVkey = _vkey;
        eligibleVotersRoot = _votersRoot;
    }
    
    function castVote(
        bytes calldata proof,
        bytes calldata publicValues
    ) external {
        // Decode public values
        bytes32 nullifier = bytes32(publicValues[0:32]);
        uint32 candidateId = uint32(bytes4(publicValues[32:36]));
        bytes32 merkleRoot = bytes32(publicValues[36:68]);
        
        // Verify the merkle root matches
        require(merkleRoot == eligibleVotersRoot, "Invalid voter set");
        
        // Check nullifier hasn't been used
        require(!nullifierUsed[nullifier], "Already voted");
        
        // Verify the proof
        verifier.verifyProof(votingProgramVkey, publicValues, proof);
        
        // Record the vote
        nullifierUsed[nullifier] = true;
        voteCounts[candidateId]++;
        
        emit VoteCast(nullifier, candidateId);
    }
    
    function getVoteCount(uint32 candidateId) external view returns (uint256) {
        return voteCounts[candidateId];
    }
}
```

## Step 4: Deployment and Testing

### Local Testing
```bash
# Build the voting program
cd voting-program
cargo prove build

# Run the prover
cd ../script
cargo run -- \
  --voter-secret "0x1234...abcd" \
  --voter-nullifier "0xabcd...1234" \
  --candidate-id 1
```

### Using Succinct Network
```bash
# Set up network credentials
export SP1_PROVER=network
export SP1_PRIVATE_KEY="your-key-here"

# Generate proof via network (faster!)
cargo run -- \
  --voter-secret "0x1234...abcd" \
  --voter-nullifier "0xabcd...1234" \
  --candidate-id 1 \
  --use-network
```

## Performance Optimization Tips

1. **Use the Succinct Network**: Network proving is significantly faster than local
2. **Batch Operations**: Process multiple votes in a single proof when possible
3. **Optimize Circuit Logic**: Keep computations simple and avoid unnecessary operations
4. **Cache Setup**: Reuse proving/verification keys across multiple proofs

## Security Considerations

- **Nullifier Generation**: Ensure nullifiers are deterministic but unpredictable
- **Merkle Tree Updates**: Plan for adding new eligible voters
- **Time Bounds**: Consider adding voting period constraints
- **Front-running Protection**: Use commit-reveal schemes if necessary

## Conclusion

SP1 zkVM makes building privacy-preserving applications remarkably straightforward. In just a few hundred lines of Rust, we've created a fully functional, verifiable voting system that preserves voter privacy while ensuring election integrity.

The combination of familiar Rust development, flexible proving options, and production-ready infrastructure makes SP1 an excellent choice for developers entering the ZK space.

## Next Steps

- Explore SP1's advanced features like recursive proofs
- Join the Succinct community on Discord
- Apply for testnet access to use the prover network
- Check out more examples in the [SP1 repository](https://github.com/succinctlabs/sp1)

---

*Want to dive deeper? The complete code for this tutorial is available on [GitHub](https://github.com/wayne-o/zk-voting-sp1)*