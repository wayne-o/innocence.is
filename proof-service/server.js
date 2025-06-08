const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const { ethers } = require('ethers');
const { formatSP1ProofForVerifier, encodePublicValues } = require('./sp1-formatter');
const sanctionsOracle = require('./sanctions-oracle');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

const ZK_CIRCUITS_PATH = path.join(__dirname, '../zk-circuits/innocence-circuits');

// Helper to execute proof generation binaries
function executeProofBinary(command) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      USE_GROTH16: process.env.USE_GROTH16 || 'false',
      SP1_PROVER: process.env.SP1_PROVER || 'cpu',
      PATH: `/opt/homebrew/opt/go@1.22/bin:${process.env.PATH}`
    };
    
    exec(command, { cwd: ZK_CIRCUITS_PATH, env, timeout: 600000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('Proof generation error:', stderr);
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

// Compute commitment endpoint
app.post('/api/compute-commitment', (req, res) => {
  const { secret, nullifier } = req.body;

  if (!secret || !nullifier) {
    return res.status(400).json({ error: 'Missing secret or nullifier' });
  }

  // Compute commitment = keccak256(abi.encode(secret, nullifier))
  const commitment = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'bytes32'],
      [secret, nullifier]
    )
  );

  res.json({ commitment });
});

// Generate proof endpoints
app.post('/api/generate-proof/:proofType', async (req, res) => {
  const { proofType } = req.params;
  const params = req.body;

  try {
    let command;
    let publicValues;
    let proof;

    switch (proofType) {
      case 'ownership':
        // Generate real ownership proof using SP1
        command = `cargo run --bin ownership-proof --release -- --prove --secret ${params.secret} --nullifier ${params.nullifier}`;

        const ownershipOutput = await executeProofBinary(command);
        console.log('Ownership proof generated:', ownershipOutput);

        // Read the generated proof file
        const fs = require('fs');
        const ownershipProofPath = path.join(ZK_CIRCUITS_PATH, 'ownership_proof.json');

        if (fs.existsSync(ownershipProofPath)) {
          proof = JSON.parse(fs.readFileSync(ownershipProofPath, 'utf8'));
        } else {
          throw new Error('Ownership proof file not found');
        }

        const nullifierHash = ethers.keccak256(params.nullifier);
        const commitment = ethers.keccak256(
          ethers.AbiCoder.defaultAbiCoder().encode(
            ['bytes32', 'bytes32'],
            [params.secret, params.nullifier]
          )
        );

        publicValues = {
          commitment,
          nullifierHash
        };

        return res.json({
          proof,
          publicValues,
          commitment,
          proofType: 'ownership',
          timestamp: Date.now()
        });

      case 'balance':
        // Generate real balance proof using SP1
        command = `cargo run --bin balance-proof --release -- --prove --secret ${params.secret} --nullifier ${params.nullifier} --balance ${params.balance} --min-balance ${params.minBalance} --asset-id ${params.assetId}`;

        const balanceOutput = await executeProofBinary(command);
        console.log('Balance proof generated:', balanceOutput);

        // Read the generated proof file
        const balanceProofPath = path.join(ZK_CIRCUITS_PATH, 'balance_proof.json');

        let balanceProofData;
        if (require('fs').existsSync(balanceProofPath)) {
          balanceProofData = JSON.parse(require('fs').readFileSync(balanceProofPath, 'utf8'));
          // Handle new format from Rust with rawBytes
          proof = balanceProofData.proof || balanceProofData;
        } else {
          throw new Error('Balance proof file not found');
        }

        const commitmentBal = ethers.keccak256(
          ethers.AbiCoder.defaultAbiCoder().encode(
            ['bytes32', 'bytes32'],
            [params.secret, params.nullifier]
          )
        );

        publicValues = {
          commitment: commitmentBal,
          merkleRoot: params.merkleRoot || ethers.ZeroHash,
          minBalance: params.minBalance,
          assetId: params.assetId
        };

        // Format the proof for SP1VerifierGroth16
        const formattedBalanceProof = formatSP1ProofForVerifier(balanceProofData);
        const encodedBalancePublicValues = encodePublicValues('balance', publicValues);
        
        return res.json({
          proof,
          formattedProof: formattedBalanceProof,
          publicValues,
          encodedPublicValues: encodedBalancePublicValues,
          proofType: 'balance',
          timestamp: Date.now()
        });

      case 'compliance':
        // Generate real compliance proof using SP1
        command = `cargo run --bin compliance-proof --release -- --prove --secret ${params.secret} --nullifier ${params.nullifier} --valid-days ${params.validDays || 365}`;

        const complianceOutput = await executeProofBinary(command);
        console.log('Compliance proof generated:', complianceOutput);

        // Read the generated proof file
        const complianceProofPath = path.join(ZK_CIRCUITS_PATH, 'compliance_proof.json');

        let proofData;
        if (require('fs').existsSync(complianceProofPath)) {
          proofData = JSON.parse(require('fs').readFileSync(complianceProofPath, 'utf8'));
          // Handle new format from Rust with rawBytes
          proof = proofData.proof || proofData;
        } else {
          throw new Error('Compliance proof file not found');
        }

        const commitmentComp = ethers.keccak256(
          ethers.AbiCoder.defaultAbiCoder().encode(
            ['bytes32', 'bytes32'],
            [params.secret, params.nullifier]
          )
        );

        publicValues = {
          commitment: commitmentComp,
          complianceAuthority: '0x5Bd2F329C50860366c0E6D3b4227a422B66AD203',
          validUntil: Math.floor(Date.now() / 1000) + (params.validDays || 365) * 24 * 60 * 60,
          certificateHash: ethers.keccak256(ethers.toUtf8Bytes('certificate'))
        };

        // Format the proof for SP1VerifierGroth16
        const formattedComplianceProof = formatSP1ProofForVerifier(proofData);
        const encodedCompliancePublicValues = encodePublicValues('compliance', publicValues);
        
        return res.json({
          proof,
          formattedProof: formattedComplianceProof,
          publicValues,
          encodedPublicValues: encodedCompliancePublicValues,
          commitment: commitmentComp,
          proofType: 'compliance',
          timestamp: Date.now()
        });

      case 'trade':
        // Generate real trade proof using SP1
        command = `cargo run --bin trade-proof --release -- --prove --secret ${params.secret} --nullifier ${params.nullifier} --from-asset ${params.fromAsset} --to-asset ${params.toAsset} --from-amount ${params.fromAmount} --min-to-amount ${params.minToAmount}`;

        const tradeOutput = await executeProofBinary(command);
        console.log('Trade proof generated:', tradeOutput);

        // Read the generated proof file
        const tradeProofPath = path.join(ZK_CIRCUITS_PATH, 'trade_proof.json');

        let tradeProofData;
        if (require('fs').existsSync(tradeProofPath)) {
          tradeProofData = JSON.parse(require('fs').readFileSync(tradeProofPath, 'utf8'));
          // Handle new format from Rust with rawBytes
          proof = tradeProofData.proof || tradeProofData;
        } else {
          throw new Error('Trade proof file not found');
        }

        const commitmentTrade = ethers.keccak256(
          ethers.AbiCoder.defaultAbiCoder().encode(
            ['bytes32', 'bytes32'],
            [params.secret, params.nullifier]
          )
        );

        publicValues = {
          commitment: commitmentTrade,
          fromAsset: params.fromAsset,
          toAsset: params.toAsset,
          fromAmount: params.fromAmount,
          minToAmount: params.minToAmount
        };

        // Add user address for trade proofs
        publicValues.user = params.userAddress || '0x0000000000000000000000000000000000000000';
        publicValues.merkleRoot = params.merkleRoot || ethers.ZeroHash;
        
        // Format the proof for SP1VerifierGroth16
        const formattedTradeProof = formatSP1ProofForVerifier(tradeProofData);
        const encodedTradePublicValues = encodePublicValues('trade', publicValues);
        
        return res.json({
          proof,
          formattedProof: formattedTradeProof,
          publicValues,
          encodedPublicValues: encodedTradePublicValues,
          proofType: 'trade',
          timestamp: Date.now()
        });

      default:
        return res.status(400).json({ error: 'Invalid proof type' });
    }
  } catch (error) {
    console.error('Proof generation error:', error);
    res.status(500).json({
      error: 'Failed to generate proof',
      details: error.message
    });
  }
});

// Encode public values endpoint
app.post('/api/encode-public-values/:proofType', (req, res) => {
  const { proofType } = req.params;
  const values = req.body;

  try {
    let encoded;

    switch (proofType) {
      case 'ownership':
        encoded = ethers.AbiCoder.defaultAbiCoder().encode(
          ['bytes32', 'bytes32'],
          [values.commitment, values.nullifierHash]
        );
        break;

      case 'balance':
        encoded = ethers.AbiCoder.defaultAbiCoder().encode(
          ['bytes32', 'bytes32', 'uint256', 'uint64'],
          [values.commitment, values.merkleRoot, values.minBalance, values.assetId]
        );
        break;

      case 'compliance':
        encoded = ethers.AbiCoder.defaultAbiCoder().encode(
          ['bytes32', 'address', 'uint256', 'bytes32'],
          [values.commitment, values.complianceAuthority, values.validUntil, values.certificateHash]
        );
        break;

      case 'trade':
        encoded = ethers.AbiCoder.defaultAbiCoder().encode(
          ['bytes32', 'uint64', 'uint64', 'uint256', 'uint256'],
          [values.commitment, values.fromAsset, values.toAsset, values.fromAmount, values.minToAmount]
        );
        break;

      default:
        return res.status(400).json({ error: 'Invalid proof type' });
    }

    res.json({ encoded });
  } catch (error) {
    console.error('Encoding error:', error);
    res.status(500).json({
      error: 'Failed to encode public values',
      details: error.message
    });
  }
});

// Sanctions check endpoints
app.get('/api/sanctions/check/:address', (req, res) => {
  const { address } = req.params;
  
  try {
    const status = sanctionsOracle.getSanctionsStatus(address);
    res.json(status);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/sanctions/root', (req, res) => {
  res.json({
    sanctionsRoot: sanctionsOracle.getSanctionsRoot(),
    timestamp: Date.now()
  });
});

app.get('/api/sanctions/list', (req, res) => {
  // Public endpoint for transparency
  res.json({
    sanctionedAddresses: sanctionsOracle.getAllSanctioned(),
    total: sanctionsOracle.getAllSanctioned().length,
    lastUpdate: sanctionsOracle.lastUpdate
  });
});

// Generate innocence proof endpoint
app.post('/api/generate-proof/innocence', async (req, res) => {
  const { depositor } = req.body;
  
  if (!depositor) {
    return res.status(400).json({ error: 'Missing depositor address' });
  }
  
  try {
    // Check sanctions status
    const status = sanctionsOracle.getSanctionsStatus(depositor);
    
    if (status.isSanctioned) {
      return res.status(403).json({
        error: 'Address is sanctioned',
        address: depositor,
        sanctionsRoot: status.sanctionsRoot
      });
    }
    
    // Generate innocence proof using SP1
    const command = `cargo run --bin innocence-proof --release -- --prove --depositor ${depositor}`;
    
    const output = await executeProofBinary(command);
    console.log('Innocence proof generated:', output);
    
    // Read the generated proof file
    const proofPath = path.join(ZK_CIRCUITS_PATH, 'innocence_proof.json');
    
    let proofData;
    if (require('fs').existsSync(proofPath)) {
      proofData = JSON.parse(require('fs').readFileSync(proofPath, 'utf8'));
      // Handle new format from Rust with rawBytes
      const proof = proofData.proof || proofData;
      
      const publicValues = {
        depositor,
        sanctionsRoot: status.sanctionsRoot,
        timestamp: status.timestamp,
        isInnocent: true
      };
      
      // Format the proof for SP1VerifierGroth16
      const formattedProof = formatSP1ProofForVerifier(proofData);
      const encodedPublicValues = encodePublicValues('innocence', publicValues);
      
      return res.json({
        proof,
        formattedProof,
        publicValues,
        encodedPublicValues,
        status,
        proofType: 'innocence',
        timestamp: Date.now()
      });
    } else {
      throw new Error('Innocence proof file not found');
    }
  } catch (error) {
    console.error('Innocence proof generation error:', error);
    res.status(500).json({
      error: 'Failed to generate innocence proof',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Proof service running on port ${PORT}`);
  console.log(`Sanctions oracle initialized with ${sanctionsOracle.getAllSanctioned().length} sanctioned addresses`);
});