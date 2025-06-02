import React, { useState, useEffect } from 'react';
import { parseUnits, formatUnits } from 'ethers';
import { HyperCoreAsset } from '../types';
import { PrivacySystemService } from '../services/blockchain-v4';
import proofService from '../services/proofService';
import { AssetSelector } from './AssetSelector';
import './PrivateWithdraw.css';

interface PrivateWithdrawProps {
  privacySystem: PrivacySystemService;
  userAddress: string;
}

interface StoredDeposit {
  commitment: string;
  asset: string;
  amount: string;
  txHash: string;
  timestamp: number;
}

export function PrivateWithdraw({ privacySystem, userAddress }: PrivateWithdrawProps) {
  const [selectedAsset, setSelectedAsset] = useState<HyperCoreAsset | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [generatingProof, setGeneratingProof] = useState(false);
  const [deposits, setDeposits] = useState<StoredDeposit[]>([]);
  const [selectedDeposit, setSelectedDeposit] = useState<StoredDeposit | null>(null);
  const [uploadedFile, setUploadedFile] = useState<any>(null);

  // Asset decimals mapping
  const assetDecimals: { [key: string]: number } = {
    '0': 6,   // USDC
    '1': 8,   // BTC
    '2': 18,  // ETH
    '3': 18,  // ARB
    '4': 18,  // AVAX
    '5': 18,  // BNB
    '6': 18,  // MATIC
    '7': 18,  // OP
    '8': 9,   // SOL
    '9': 9,   // SUI
    '10': 18, // HYPE
    '11': 6   // USDT
  };

  // Load deposits from localStorage
  useEffect(() => {
    const loadedDeposits: StoredDeposit[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('deposit_')) {
        try {
          const deposit = JSON.parse(localStorage.getItem(key) || '');
          loadedDeposits.push(deposit);
        } catch (e) {
          console.error('Failed to parse deposit:', e);
        }
      }
    }
    setDeposits(loadedDeposits.sort((a, b) => b.timestamp - a.timestamp));
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setUploadedFile(data);
        setError(null);
        
        // Auto-select matching deposit if found
        const matchingDeposit = deposits.find(d => d.commitment === data.commitment);
        if (matchingDeposit) {
          setSelectedDeposit(matchingDeposit);
        }
      } catch (err) {
        setError('Invalid commitment file');
      }
    };
    reader.readAsText(file);
  };

  const handleWithdraw = async () => {
    if (!selectedAsset || !amount) {
      setError('Please fill all fields');
      return;
    }

    if (!selectedDeposit && !uploadedFile) {
      setError('Please select a deposit or upload a commitment file');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Get commitment data
      const commitment = selectedDeposit?.commitment || uploadedFile?.commitment;
      const commitmentData = uploadedFile || proofService.getCommitmentData(commitment);
      
      if (!commitmentData) {
        setError('Commitment data not found. Please upload your commitment file.');
        return;
      }

      // Get merkle root from contract
      const merkleRoot = await privacySystem.getMerkleRoot();

      // Generate balance proof
      setGeneratingProof(true);
      // For pure EVM contract, always use 18 decimals (native currency)
      const amountWei = parseUnits(amount, 18);
      
      // Ensure amount is positive 
      const withdrawalAmount = Math.abs(Number(amountWei));
      console.log('Original amount:', amount, 'ETH');
      console.log('Amount in wei:', amountWei.toString());
      console.log('Final withdrawal amount:', withdrawalAmount);
      
      // For pure EVM contract, always use token ID 0 (native currency)
      const tokenId = 0;
      
      const { nullifier, proofBytes, publicValues } = await proofService.generateWithdrawalProof(
        commitment,
        tokenId,
        withdrawalAmount,
        merkleRoot
      );
      setGeneratingProof(false);
      
      console.log('Withdrawal params:', {
        nullifier,
        recipient: userAddress,
        token: tokenId,
        amount: withdrawalAmount.toString(),
      });
      
      // Pure EVM withdrawal - use manual gas estimation to avoid overflow
      console.log('Submitting pure EVM withdrawal...');
      const tx = await privacySystem.withdrawWithoutGasEstimation({
        nullifier,
        recipient: userAddress,
        token: tokenId,
        amount: withdrawalAmount.toString(), // Use positive amount
        balanceProof: proofBytes,
        publicValues: publicValues,
      });

      console.log('Transaction submitted:', tx.hash);
      
      try {
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt);
        
        setSuccess(`Withdrawal successful! TX: ${tx.hash}`);
        setAmount('');
        
        // Remove the deposit from localStorage since it's been withdrawn
        if (selectedDeposit) {
          localStorage.removeItem(`deposit_${selectedDeposit.commitment}`);
          setDeposits(deposits.filter(d => d.commitment !== selectedDeposit.commitment));
          setSelectedDeposit(null);
        }
      } catch (waitError) {
        console.error('Error waiting for transaction:', waitError);
        setSuccess(`Transaction submitted! TX Hash: ${tx.hash}`);
      }
      
    } catch (err: any) {
      setError(err.message || 'Withdrawal failed');
      console.error('Withdrawal error:', err);
    } finally {
      setLoading(false);
      setGeneratingProof(false);
    }
  };

  return (
    <div className="private-withdraw">
      <h2>Private Withdrawal with ZK Proof</h2>
      
      <div className="withdraw-form">
        <div className="form-group">
          <label>Select Deposit or Upload Commitment</label>
          
          {deposits.length > 0 && (
            <div className="deposits-list">
              <h4>Your Deposits:</h4>
              {deposits.map((deposit) => (
                <div 
                  key={deposit.commitment}
                  className={`deposit-item ${selectedDeposit?.commitment === deposit.commitment ? 'selected' : ''}`}
                  onClick={() => setSelectedDeposit(deposit)}
                >
                  <div>Asset ID: {deposit.asset}</div>
                  <div>Amount: {formatUnits(deposit.amount, assetDecimals[deposit.asset] || 6)}</div>
                  <div>Date: {new Date(deposit.timestamp).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
          
          <div className="file-upload">
            <label htmlFor="commitment-file">Or upload commitment file:</label>
            <input
              id="commitment-file"
              type="file"
              accept=".json"
              onChange={handleFileUpload}
            />
            {uploadedFile && (
              <div className="uploaded-info">
                ✅ File loaded: {uploadedFile.asset} - {uploadedFile.amount}
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label>Asset to Withdraw</label>
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

        <div className="info-box">
          <p>🔓 Withdraw funds privately using ZK balance proof</p>
          <p>📍 Funds will be sent to your connected wallet</p>
          <p>⚠️ Each deposit can only be withdrawn once</p>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <button
          className="withdraw-btn"
          onClick={handleWithdraw}
          disabled={loading || !selectedAsset || !amount || (!selectedDeposit && !uploadedFile)}
        >
          {generatingProof ? 'Generating ZK Proof...' : 
           loading ? 'Processing Transaction...' : 
           'Withdraw Privately'}
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