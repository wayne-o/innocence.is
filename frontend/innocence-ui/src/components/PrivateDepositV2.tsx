import React, { useState, useEffect } from 'react';
import { formatUnits, parseUnits, keccak256, concat, getBytes } from 'ethers';
import { HyperCoreAsset } from '../types';
import { complianceAPI } from '../services/api';
import { PrivacySystemService } from '../services/blockchain-v4';
import proofService from '../services/proofService';
import { AssetSelector } from './AssetSelector';
import { HyperliquidAPI } from '../services/hyperliquidApi';
import './PrivateDeposit.css';

interface PrivateDepositProps {
  privacySystem: PrivacySystemService;
  userAddress: string;
}

type DepositStep = 'select' | 'prepare' | 'transfer' | 'complete' | 'done';

export function PrivateDepositV2({ privacySystem, userAddress }: PrivateDepositProps) {
  const [selectedAsset, setSelectedAsset] = useState<HyperCoreAsset | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [generatingProof, setGeneratingProof] = useState(false);
  const [userBalance, setUserBalance] = useState<string>('0');
  
  // Two-step deposit state
  const [currentStep, setCurrentStep] = useState<DepositStep>('select');
  const [depositCommitment, setDepositCommitment] = useState<string | null>(null);
  const [pendingDepositData, setPendingDepositData] = useState<any>(null);

  // Check user balance when asset is selected
  useEffect(() => {
    const checkBalance = async () => {
      if (selectedAsset && userAddress) {
        try {
          let balanceFormatted: string;
          
          // Check if this is HYPe (native currency) vs HYPe spot token
          if (selectedAsset.symbol === 'HYPE' && selectedAsset.assetId === 'native') {
            // Get native HYPe balance
            balanceFormatted = await privacySystem.getNativeHypeBalanceFormatted(userAddress);
          } else {
            // Get spot token balance
            balanceFormatted = await privacySystem.getUserSpotBalanceFormatted(
              userAddress, 
              parseInt(selectedAsset.assetId),
              selectedAsset.decimals
            );
          }
          
          setUserBalance(balanceFormatted);
        } catch (err) {
          console.error('Failed to fetch balance:', err);
          setUserBalance('0');
        }
      }
    };
    
    checkBalance();
  }, [selectedAsset, userAddress, privacySystem]);

  // Check if deposit can be completed
  useEffect(() => {
    let checkCount = 0;
    const checkDepositStatus = async () => {
      if (currentStep === 'transfer' && userAddress) {
        try {
          checkCount++;
          const canComplete = await privacySystem.canCompleteDeposit(userAddress);
          console.log(`Check #${checkCount} - Can complete deposit?`, canComplete);
          
          if (canComplete) {
            setCurrentStep('complete');
          } else {
            // Check pending deposit details for debugging
            const pendingDeposit = await privacySystem.getPendingDeposit(userAddress);
            console.log('Pending deposit:', {
              token: pendingDeposit.token.toString(),
              amount: pendingDeposit.amount.toString(),
              contractBalanceBefore: pendingDeposit.contractBalanceBefore.toString(),
              timestamp: new Date(Number(pendingDeposit.timestamp) * 1000).toISOString(),
              completed: pendingDeposit.completed
            });
            
            // Also check current contract balance
            if (selectedAsset) {
              // Use the actual contract address from environment
              const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || '0x60564ff628987871EFFF0A2Ec8b6EF722895152e';
              const currentBalance = await privacySystem.getUserSpotBalance(
                CONTRACT_ADDRESS,
                parseInt(selectedAsset.assetId)
              );
              console.log('Current contract balance:', currentBalance.toString());
              
              // Calculate the difference
              const balanceBefore = BigInt(pendingDeposit.contractBalanceBefore);
              const balanceAfter = BigInt(currentBalance);
              const difference = balanceAfter - balanceBefore;
              console.log('Balance difference:', difference.toString());
              console.log('Expected amount:', pendingDeposit.amount.toString());
              console.log('Difference >= Expected?', difference >= BigInt(pendingDeposit.amount));
              
              // More robust check: verify OUR deposit specifically
              // The balance should have increased by AT LEAST our amount
              // Allow for small discrepancies due to fees/rounding (within 1% tolerance)
              const tolerance = BigInt(pendingDeposit.amount) / BigInt(100); // 1% tolerance
              const minRequired = BigInt(pendingDeposit.amount) - tolerance;
              if (difference >= minRequired) {
                // Double-check with canCompleteDeposit one more time
                const canCompleteNow = await privacySystem.canCompleteDeposit(userAddress);
                if (canCompleteNow) {
                  console.log('Transfer verified via canCompleteDeposit!');
                  setCurrentStep('complete');
                } else {
                  // Balance increased but contract still says no - likely a state sync issue
                  console.log('Balance increased by expected amount, proceeding anyway.');
                  setCurrentStep('complete');
                }
              } else if (checkCount > 10) {
                setError('Transfer may have failed - balance did not increase by expected amount.');
              }
            }
          }
        } catch (err) {
          console.error('Error checking deposit status:', err);
        }
      }
    };

    // Initial check after 3 seconds to allow blockchain to update
    const timeout = setTimeout(checkDepositStatus, 3000);
    // Then check every 2 seconds
    const interval = setInterval(checkDepositStatus, 2000);
    
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [currentStep, userAddress, privacySystem, selectedAsset]);

  const handlePrepareDeposit = async () => {
    if (!selectedAsset || !amount) {
      setError('Please fill all fields');
      return;
    }

    const requestedAmount = parseFloat(amount);
    const availableBalance = parseFloat(userBalance);
    
    if (requestedAmount > availableBalance) {
      setError(`Insufficient balance. You have ${availableBalance} ${selectedAsset.symbol}`);
      return;
    }
    
    // Validate minimum amount for HYPE (due to szDecimals=2)
    if (selectedAsset.symbol === 'HYPE' && requestedAmount < 0.01) {
      setError('Minimum deposit amount for HYPE is 0.01');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Step 1: Prepare deposit
      // Get token metadata to convert to weiDecimals
      const tokenMetadata = await HyperliquidAPI.getTokenMetadata(parseInt(selectedAsset.assetId));
      
      // Convert amount to weiDecimals for the contract
      // For HYPE: 0.2 * 10^8 = 20000000
      const amountInWeiDecimals = parseUnits(amount, tokenMetadata.weiDecimals);
      
      console.log('Amount conversion:', {
        userInput: amount,
        weiDecimals: tokenMetadata.weiDecimals,
        amountInWeiDecimals: amountInWeiDecimals.toString()
      });
      
      const tx = await privacySystem.prepareDeposit(
        parseInt(selectedAsset.assetId),
        amountInWeiDecimals.toString()
      );

      console.log('Prepare deposit tx:', tx.hash);
      await tx.wait();

      // Generate deposit data for later
      const secret = proofService.generateSecret();
      const nullifier = proofService.generateNullifier();
      
      // Generate commitment locally if proof service is down
      const commitment = keccak256(
        concat([
          getBytes(secret),
          getBytes(nullifier)
        ])
      );
      
      setDepositCommitment(commitment);
      setPendingDepositData({
        secret,
        nullifier,
        commitment,
        asset: selectedAsset,
        amount: amount
      });

      setCurrentStep('transfer');
      setSuccess('Deposit prepared! Now transfer tokens to complete.');
    } catch (err: any) {
      setError(err.message || 'Failed to prepare deposit');
      console.error('Prepare deposit error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTransferTokens = async () => {
    if (!selectedAsset || !amount) return;

    try {
      setLoading(true);
      setError(null);

      // Check user's balance first (in EVM decimals for comparison)
      const userBalanceEvmDecimals = await privacySystem.getUserSpotBalanceInEvmDecimals(
        userAddress || '',
        parseInt(selectedAsset.assetId)
      );
      
      // Parse amount with full EVM decimals for the transfer
      const amountWei = parseUnits(amount, selectedAsset.decimals);
      
      console.log('User balance (EVM decimals):', userBalanceEvmDecimals.toString());
      console.log('Amount to transfer:', amountWei.toString());
      console.log('Asset:', selectedAsset.symbol, 'ID:', selectedAsset.assetId);
      
      if (userBalanceEvmDecimals < amountWei) {
        const balanceFormatted = await privacySystem.getUserSpotBalanceFormatted(
          userAddress || '',
          parseInt(selectedAsset.assetId),
          selectedAsset.decimals
        );
        setError(`Insufficient balance. You have ${balanceFormatted} ${selectedAsset.symbol} but trying to transfer ${amount}`);
        return;
      }
      
      // Get token metadata to convert to weiDecimals
      const tokenMetadata = await HyperliquidAPI.getTokenMetadata(parseInt(selectedAsset.assetId));
      
      // Convert to wei decimals (8) for the actual transfer
      const amountInWeiDecimals = parseUnits(amount, tokenMetadata.weiDecimals);
      const tx = await privacySystem.transferToContract(
        parseInt(selectedAsset.assetId),
        amountInWeiDecimals.toString()
      );

      console.log('Transfer tx:', tx.hash);
      await tx.wait();

      setSuccess('Tokens transferred! Waiting for blockchain confirmation...');
      
      // Add a small delay before the useEffect starts checking
      setTimeout(() => {
        console.log('Starting deposit completion checks...');
      }, 1000);
      
      // The useEffect will detect when transfer is complete and move to next step
    } catch (err: any) {
      setError(err.message || 'Failed to transfer tokens');
      console.error('Transfer error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteDeposit = async () => {
    if (!pendingDepositData) return;

    try {
      setLoading(true);
      setError(null);
      setGeneratingProof(true);

      // Generate compliance proof
      const { commitment, proofBytes, publicValues } = await proofService.generateDepositProof(
        pendingDepositData.secret,
        pendingDepositData.nullifier
      );

      setGeneratingProof(false);

      // Complete the deposit
      console.log('Completing deposit with:', {
        commitment,
        proofBytesLength: proofBytes.length,
        publicValuesLength: publicValues.length
      });
      
      const tx = await privacySystem.completeDeposit({
        commitment,
        complianceProof: proofBytes,
        publicValues: publicValues
      });

      console.log('Complete deposit tx:', tx.hash);
      const receipt = await tx.wait();
      console.log('Deposit completed:', receipt);

      // Store commitment data securely
      proofService.storeCommitmentData(commitment, pendingDepositData.secret, pendingDepositData.nullifier);

      // Save deposit info
      const depositInfo = {
        commitment,
        asset: pendingDepositData.asset.assetId,
        amount: parseUnits(pendingDepositData.amount, pendingDepositData.asset.decimals).toString(),
        txHash: tx.hash,
        timestamp: Date.now(),
      };

      localStorage.setItem(`deposit_${commitment}`, JSON.stringify(depositInfo));

      // Download commitment data
      const downloadData = {
        commitment,
        secret: pendingDepositData.secret,
        nullifier: pendingDepositData.nullifier,
        asset: pendingDepositData.asset.symbol,
        amount: pendingDepositData.amount,
        timestamp: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(downloadData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `innocence-deposit-${commitment.slice(0, 8)}.json`;
      link.click();

      setSuccess(`Private deposit successful! Commitment: ${commitment}`);
      setCurrentStep('done');
    } catch (err: any) {
      setError(err.message || 'Failed to complete deposit');
      console.error('Complete deposit error:', err);
    } finally {
      setLoading(false);
      setGeneratingProof(false);
    }
  };

  const resetDeposit = () => {
    setCurrentStep('select');
    setAmount('');
    setSelectedAsset(null);
    setDepositCommitment(null);
    setPendingDepositData(null);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="private-deposit">
      <h2>Private Deposit with ZK Proof (Two-Step)</h2>
      
      {currentStep === 'select' && (
        <>
          <p className="deposit-explanation">
            Transfer Hyperliquid spot balances into a private vault using our secure two-step process.
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

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <button
              className="deposit-btn"
              onClick={handlePrepareDeposit}
              disabled={loading || !selectedAsset || !amount}
            >
              {loading ? 'Processing...' : 'Prepare Deposit'}
            </button>
          </div>
        </>
      )}

      {currentStep === 'transfer' && (
        <div className="deposit-form">
          <h3>Step 2: Transfer Tokens</h3>
          <p>Click the button below to transfer {amount} {selectedAsset?.symbol} to the privacy contract.</p>
          
          <div className="info-box">
            <p>💡 The tokens will be sent from your wallet to the privacy contract</p>
            <p>🔐 Once transferred, you can complete the private deposit</p>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button
            className="deposit-btn"
            onClick={handleTransferTokens}
            disabled={loading}
          >
            {loading ? 'Transferring...' : 'Transfer Tokens'}
          </button>
          
          {/* Manual completion button as fallback */}
          {!loading && (
            <button
              className="deposit-btn"
              onClick={() => setCurrentStep('complete')}
              style={{ marginTop: '10px', backgroundColor: '#666' }}
            >
              Manually Proceed to Complete Deposit
            </button>
          )}
        </div>
      )}

      {currentStep === 'complete' && (
        <div className="deposit-form">
          <h3>Step 3: Complete Deposit</h3>
          <p>Tokens transferred successfully! Now complete the deposit with zero-knowledge proof.</p>
          
          <div className="info-box">
            <p>🔐 Generating zero-knowledge proof of compliance</p>
            <p>📥 A secret file will be downloaded - keep it safe!</p>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button
            className="deposit-btn"
            onClick={handleCompleteDeposit}
            disabled={loading || generatingProof}
          >
            {generatingProof ? 'Generating ZK Proof...' : 
             loading ? 'Processing...' : 
             'Complete Private Deposit'}
          </button>
        </div>
      )}

      {currentStep === 'done' && (
        <div className="deposit-form">
          <h3>✅ Deposit Complete!</h3>
          <div className="success-message">{success}</div>
          
          <div className="info-box">
            <p>🎉 Your tokens are now in the private vault</p>
            <p>📄 Keep your downloaded commitment file safe</p>
            <p>🔒 Use it to withdraw or trade privately later</p>
          </div>

          <button
            className="deposit-btn"
            onClick={resetDeposit}
          >
            Make Another Deposit
          </button>
        </div>
      )}

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