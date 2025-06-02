const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const { ethers } = require('ethers');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

const ZK_CIRCUITS_PATH = path.join(__dirname, '../zk-circuits/innocence-circuits');

// Helper to execute proof generation binaries
function executeProofBinary(command) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: ZK_CIRCUITS_PATH }, (error, stdout, stderr) => {
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
        
        if (require('fs').existsSync(balanceProofPath)) {
          proof = JSON.parse(require('fs').readFileSync(balanceProofPath, 'utf8'));
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
        
        return res.json({
          proof,
          publicValues,
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
        
        if (require('fs').existsSync(complianceProofPath)) {
          proof = JSON.parse(require('fs').readFileSync(complianceProofPath, 'utf8'));
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
        
        return res.json({
          proof,
          publicValues,
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
        
        if (require('fs').existsSync(tradeProofPath)) {
          proof = JSON.parse(require('fs').readFileSync(tradeProofPath, 'utf8'));
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
        
        return res.json({
          proof,
          publicValues,
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

app.listen(PORT, () => {
  console.log(`Proof service running on port ${PORT}`);
});