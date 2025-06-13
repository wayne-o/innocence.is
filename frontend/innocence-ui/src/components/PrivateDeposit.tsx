import React, { useState, useEffect } from 'react';
import { formatUnits, parseUnits } from 'ethers';
import { HyperCoreAsset } from '../types';
import { complianceAPI } from '../services/api';
import { PrivacySystemService } from '../services/blockchain-v4';
import proofService from '../services/proofService';
import { AssetSelector } from './AssetSelector';
import './PrivateDeposit.css';

interface PrivateDepositProps {
  privacySystem: PrivacySystemService;
  userAddress: string;
}

export function PrivateDeposit({ privacySystem, userAddress }: PrivateDepositProps) {
  const [selectedAsset, setSelectedAsset] = useState<HyperCoreAsset | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [generatingProof, setGeneratingProof] = useState(false);
  const [userBalance, setUserBalance] = useState<string>('0');

  // Check user balance when asset is selected
  useEffect(() => {
    const checkBalance = async () => {
      if (selectedAsset && userAddress) {
        try {
          const balance = await privacySystem.getUserSpotBalance(
            userAddress, 
            parseInt(selectedAsset.assetId)
          );
          setUserBalance(formatUnits(balance, selectedAsset.decimals));
        } catch (err) {
          console.error('Failed to fetch balance:', err);
          setUserBalance('0');
        }
      }
    };
    
    checkBalance();
  }, [selectedAsset, userAddress, privacySystem]);

  const handleDeposit = async () => {
    if (!selectedAsset || !amount) {
      setError('Please fill all fields');
      return;
    }

    // Check if user has sufficient balance
    const requestedAmount = parseFloat(amount);
    const availableBalance = parseFloat(userBalance);
    
    if (requestedAmount > availableBalance) {
      setError(`Insufficient balance. You have ${availableBalance} ${selectedAsset.symbol}`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Generate random secret and nullifier
      const secret = proofService.generateSecret();
      const nullifier = proofService.generateNullifier();
      
      // Generate compliance proof
      setGeneratingProof(true);
      const { commitment, proofBytes, publicValues } = await proofService.generateDepositProof(
        secret,
        nullifier
      );
      setGeneratingProof(false);

      // Store commitment data securely
      proofService.storeCommitmentData(commitment, secret, nullifier);

      // Execute deposit with ZK proof
      const amountWei = parseUnits(amount, selectedAsset.decimals);
      
      console.log('Deposit params:', {
        commitment,
        asset: selectedAsset.assetId,
        amount: amountWei.toString(),
        proof: proofBytes.slice(0, 66) + '...',
      });
      
      const tx = await privacySystem.depositWithProof({
        commitment,
        token: parseInt(selectedAsset.assetId),
        amount: amountWei.toString(),
        complianceProof: proofBytes,
        publicValues: publicValues,
      });

      console.log('Transaction submitted:', tx.hash);
      
      try {
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt);
        
        // Update the stored commitment data to include balance information
        const storedData = proofService.getCommitmentData(commitment);
        if (storedData) {
          const positionData = {
            commitment,
            secret: storedData.secret,
            nullifier: storedData.nullifier,
            timestamp: Date.now(),
            balances: {
              [selectedAsset.symbol]: amount // Store the display amount
            },
            lastUpdated: Date.now()
          };
          
          // Store the updated position with balance
          localStorage.setItem(`innocence_${commitment}`, JSON.stringify(positionData));
        }
        
        // Save deposit info locally (for record keeping)
        const depositInfo = {
          commitment,
          asset: selectedAsset.assetId,
          amount: amountWei.toString(),
          txHash: tx.hash,
          timestamp: Date.now(),
        };

        localStorage.setItem(
          `deposit_${commitment}`,
          JSON.stringify(depositInfo)
        );

        setSuccess(`Private deposit successful! Save this commitment: ${commitment}`);
        setAmount('');
      } catch (waitError) {
        console.error('Error waiting for transaction:', waitError);
        // Transaction might still be pending
        setSuccess(`Transaction submitted! TX Hash: ${tx.hash}`);
      }
      
      // Show download link for commitment data
      const downloadData = {
        commitment,
        secret,
        nullifier,
        asset: selectedAsset.symbol,
        amount: amount,
        timestamp: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(downloadData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `innocence-deposit-${commitment.slice(0, 8)}.json`;
      link.click();
      
    } catch (err: any) {
      setError(err.message || 'Deposit failed');
      console.error('Deposit error:', err);
    } finally {
      setLoading(false);
      setGeneratingProof(false);
    }
  };

  return (
    <div className="private-deposit">
      <h2>Private Deposit with ZK Proof</h2>
      <p className="deposit-explanation">
        Transfer Hyperliquid spot balances into a private vault. These are account balances 
        within Hyperliquid's L1, not ERC-20 tokens.
      </p>
      
      <div className="deposit-form">
        <div className="form-group">
          <label>Asset</label>
          {selectedAsset ? (
            <div className="selected-asset" onClick={() => setShowAssetSelector(true)}>
              <span>{selectedAsset.symbol}</span>
              <span className="change-link">Change</span>
            </div>
          ) : (
            <button 
              className="select-asset-btn"
              onClick={() => setShowAssetSelector(true)}
            >
              Select Asset
            </button>
          )}
        </div>

        <div className="form-group">
          <label>Amount</label>
          <input
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!selectedAsset}
          />
          {selectedAsset && (
            <div className="input-hint">
              <div>Min: {selectedAsset.minTradeSize} {selectedAsset.symbol}</div>
              <div style={{ color: parseFloat(userBalance) === 0 ? '#ff4444' : '#00ff64' }}>
                Available: {userBalance} {selectedAsset.symbol}
              </div>
            </div>
          )}
        </div>

        <div className="info-box">
          <p>💡 You're depositing Hyperliquid spot balances (not actual BTC/ETH)</p>
          <p>🔐 Your deposit will be protected by zero-knowledge proofs</p>
          <p>📥 A secret file will be downloaded - keep it safe to withdraw later!</p>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <button
          className="deposit-btn"
          onClick={handleDeposit}
          disabled={loading || !selectedAsset || !amount}
        >
          {generatingProof ? 'Generating ZK Proof...' : 
           loading ? 'Processing Transaction...' : 
           'Deposit Privately'}
        </button>
      </div>

      {showAssetSelector && (
        <div className="modal-overlay" onClick={() => setShowAssetSelector(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <AssetSelector
              onAssetSelect={(asset) => {
                setSelectedAsset(asset);
                setShowAssetSelector(false);
              }}
              filterPerps={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}