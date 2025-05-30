import React, { useState } from 'react';
import { ethers } from 'ethers';
import { HyperCoreAsset } from '../types';
import { complianceAPI } from '../services/api';
import { PrivacySystemService } from '../services/blockchain';
import { AssetSelector } from './AssetSelector';
import './PrivateDeposit.css';

interface PrivateDepositProps {
  privacySystem: PrivacySystemService;
  userAddress: string;
}

export function PrivateDeposit({ privacySystem, userAddress }: PrivateDepositProps) {
  const [selectedAsset, setSelectedAsset] = useState<HyperCoreAsset | null>(null);
  const [amount, setAmount] = useState('');
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [usingMockCompliance, setUsingMockCompliance] = useState(false);

  const handleDeposit = async () => {
    if (!selectedAsset || !amount || !secret) {
      setError('Please fill all fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Generate commitment and nullifier
      const nullifier = ethers.randomBytes(32);
      const nullifierHex = ethers.hexlify(nullifier);
      const commitment = privacySystem.generateCommitment(secret, nullifierHex);

      // Request compliance certificate
      let complianceCheck;
      try {
        const response = await fetch(process.env.REACT_APP_API_URL + '/compliance/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: userAddress,
            requestedAmount: parseFloat(amount),
            requestedAssets: [selectedAsset.assetId],
            requiresPerps: false,
            transactionHash: '',
          })
        });
        if (!response.ok) throw new Error('Backend not available');
        complianceCheck = await response.json();
        setUsingMockCompliance(false);
      } catch (err) {
        // Use mock compliance if backend is not available
        complianceCheck = await complianceAPI.checkCompliance({
          address: userAddress,
          requestedAmount: parseFloat(amount),
          requestedAssets: [selectedAsset.assetId],
          requiresPerps: false,
          transactionHash: '',
        });
        setUsingMockCompliance(true);
      }

      if (!complianceCheck.isCompliant) {
        setError(`Compliance check failed: ${complianceCheck.reasons.join(', ')}`);
        return;
      }

      // Execute deposit
      const amountWei = ethers.parseUnits(amount, selectedAsset.decimals);
      
      console.log('Deposit params:', {
        commitment,
        asset: selectedAsset.assetId,
        amount: amountWei.toString(),
        certificate: complianceCheck.certificateId,
        signature: complianceCheck.signature,
      });
      
      const tx = await privacySystem.deposit({
        commitment,
        asset: selectedAsset.assetId,
        amount: amountWei.toString(),
        certificate: complianceCheck.certificateId || '',
        signature: complianceCheck.signature || '',
      });

      await tx.wait();

      // Save deposit info locally (in production, use secure storage)
      const depositInfo = {
        commitment,
        nullifier: nullifierHex,
        asset: selectedAsset.assetId,
        amount: amountWei.toString(),
        txHash: tx.hash,
        timestamp: Date.now(),
      };

      localStorage.setItem(
        `deposit_${commitment}`,
        JSON.stringify(depositInfo)
      );

      setSuccess(`Deposit successful! Commitment: ${commitment.slice(0, 10)}...`);
      setAmount('');
      setSecret('');
    } catch (err: any) {
      setError(err.message || 'Deposit failed');
      console.error('Deposit error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="private-deposit">
      <h2>Private Deposit</h2>
      
      {usingMockCompliance && (
        <div className="mock-compliance-banner">
          ⚠️ Using mock compliance - Backend not available
        </div>
      )}
      
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
              Min: {selectedAsset.minTradeSize} {selectedAsset.symbol}
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Secret (save this!)</label>
          <input
            type="password"
            placeholder="Enter a secret phrase"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
          <div className="input-hint">
            This secret is required to withdraw your funds. Keep it safe!
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <button
          className="deposit-btn"
          onClick={handleDeposit}
          disabled={loading || !selectedAsset || !amount || !secret}
        >
          {loading ? 'Processing...' : 'Deposit Privately'}
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