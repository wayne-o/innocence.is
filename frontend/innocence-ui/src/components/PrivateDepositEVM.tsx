import React, { useState } from 'react';
import { parseEther, formatEther, ethers } from 'ethers';
import { PrivacySystemService } from '../services/blockchain-v4';
import proofService from '../services/proofService';
import './PrivateDeposit.css';

interface PrivateDepositEVMProps {
  privacySystem: PrivacySystemService;
  userAddress: string;
}

type DepositStep = 'amount' | 'deposit' | 'completing' | 'complete' | 'done';

export function PrivateDepositEVM({ privacySystem, userAddress }: PrivateDepositEVMProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatingProof, setGeneratingProof] = useState(false);
  const [currentStep, setCurrentStep] = useState<DepositStep>('amount');
  const [depositCommitment, setDepositCommitment] = useState<string | null>(null);
  const [pendingDepositData, setPendingDepositData] = useState<any>(null);

  const handlePrepareDeposit = async () => {
    if (!amount) {
      setError('Please enter an amount');
      return;
    }

    const depositAmount = parseFloat(amount);
    if (depositAmount <= 0) {
      setError('Amount must be positive');
      return;
    }

    // Minimum amount for testing
    if (depositAmount < 0.001) {
      setError('Minimum deposit amount is 0.001 ETH');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // For pure EVM, we'll use native currency (token ID 0)
      const tokenId = 0; // Native ETH-like currency
      const amountWei = parseEther(amount);
      
      console.log('Preparing EVM deposit:', {
        token: tokenId,
        amount: amountWei.toString(),
        userAddress
      });

      // Call prepareDeposit for pure EVM - this one doesn't check spot balances
      console.log('Calling pure EVM prepareDeposit...');
      const prepareTx = await privacySystem.prepareDeposit(tokenId, amountWei.toString());
      console.log('Prepare deposit tx:', prepareTx.hash);
      await prepareTx.wait();

      // Generate commitment data
      const secret = proofService.generateSecret();
      const nullifier = proofService.generateNullifier();
      const commitment = await proofService.computeCommitment(secret, nullifier);
      
      setDepositCommitment(commitment);
      setPendingDepositData({
        secret,
        nullifier,
        commitment,
        amount: amount,
        amountWei: amountWei.toString(),
        tokenId
      });

      setCurrentStep('deposit');
      setSuccess('Deposit prepared! Now send ETH to the contract.');
      
    } catch (err: any) {
      setError(err.message || 'Failed to prepare deposit');
      console.error('Prepare deposit error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTokens = async () => {
    if (!pendingDepositData) return;

    try {
      setLoading(true);
      setError(null);

      // For pure EVM, send native currency directly to the contract
      const amountWei = parseEther(amount);
      
      console.log('Sending native currency to contract:', {
        to: await privacySystem.getContractAddress(),
        value: amountWei.toString()
      });

      // Send native currency to the contract with FIXED gas limit
      const signer = await privacySystem.getSigner();
      const tx = await signer.sendTransaction({
        to: await privacySystem.getContractAddress(),
        value: amountWei,
        gasLimit: 100000, // Fixed gas - no estimation needed
        gasPrice: 1000000000 // 1 gwei - fixed price
      });

      console.log('Send tokens tx:', tx.hash);
      setSuccess('ETH sent! Hash: ' + tx.hash + ' - Waiting for completion readiness...');
      
      // Change to completing step to show we're working on completion
      setCurrentStep('completing');
      
      // Start polling for completion readiness in background
      setTimeout(() => {
        pollForCompletion();
      }, 2000); // Wait 2 seconds for block to process
      
    } catch (err: any) {
      setError(err.message || 'Failed to send tokens');
      console.error('Send tokens error:', err);
    } finally {
      setLoading(false);
    }
  };

  const pollForCompletion = async () => {
    let attempts = 0;
    const maxAttempts = 10;
    
    const checkCompletion = async () => {
      attempts++;
      try {
        // First check if contract still has balance
        const provider = privacySystem.getProvider();
        const contractAddress = await privacySystem.getContractAddress();
        const contractBalance = await provider.getBalance(contractAddress);
        if (contractBalance === BigInt(0)) {
          console.log('⚠️ Contract is empty - deposit may have been recovered already');
          setSuccess('Contract is empty. Your ETH may have been recovered via emergency withdrawal.');
          return true; // Stop polling
        }
        
        const canComplete = await privacySystem.canCompleteDeposit(userAddress);
        if (canComplete) {
          console.log('✅ Deposit ready for completion after', attempts, 'attempts');
          setSuccess('Deposit ready! Advancing to completion step...');
          
          // Automatically advance to complete step when ready
          setCurrentStep('complete');
          return true;
        }
        return false;
      } catch (error) {
        console.log('Polling attempt', attempts, 'failed:', error);
        return false;
      }
    };
    
    // Immediate check
    if (await checkCompletion()) return;
    
    // Poll every 3 seconds
    const interval = setInterval(async () => {
      if (await checkCompletion() || attempts >= maxAttempts) {
        clearInterval(interval);
        if (attempts >= maxAttempts) {
          setSuccess('ETH sent! You can try completing manually or use emergency recovery.');
        }
      }
    }, 3000);
  };

  const handleCompleteDeposit = async () => {
    if (!pendingDepositData) return;

    try {
      setLoading(true);
      setError(null);
      setGeneratingProof(true);

      // Generate compliance proof FIRST (before any RPC calls)
      console.log('Generating ZK proof...');
      const { commitment, proofBytes, publicValues } = await proofService.generateDepositProof(
        pendingDepositData.secret,
        pendingDepositData.nullifier
      );

      setGeneratingProof(false);
      console.log('✅ ZK proof generated successfully');

      // Attempt completion with FIXED gas and multiple retries
      const maxRetries = 3;
      let lastError = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Completion attempt ${attempt}/${maxRetries}...`);
          
          // Use EVM completeDeposit function (ETH should already be sent)
          const tx = await privacySystem.completeDeposit({
            commitment,
            complianceProof: proofBytes,
            publicValues
          });

          console.log('Complete deposit tx submitted:', tx.hash);
          setSuccess(`Completion submitted! Hash: ${tx.hash} - Waiting for confirmation...`);
          
          // Try to wait for confirmation, but don't fail if RPC times out
          try {
            const receipt = await tx.wait();
            console.log('✅ Completion confirmed:', receipt);
            
            // SUCCESS - break out of retry loop
            await handleSuccessfulCompletion(commitment, tx.hash);
            return;
            
          } catch (waitError) {
            console.warn('Receipt wait failed, but transaction may have succeeded:', waitError);
            
            // Don't immediately fail - the transaction might still succeed
            setSuccess(`Transaction submitted: ${tx.hash}. Checking status...`);
            
            // Wait and check if the deposit was actually completed
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            
            try {
              const pendingAfter = await privacySystem.getPendingDeposit(userAddress);
              if (pendingAfter.completed) {
                console.log('✅ Deposit was completed despite RPC timeout');
                await handleSuccessfulCompletion(commitment, tx.hash);
                return;
              }
            } catch (checkError) {
              console.warn('Could not verify completion status:', checkError);
            }
          }
          
          // If we get here, this attempt didn't clearly succeed - try again
          
        } catch (submitError: any) {
          lastError = submitError;
          console.log(`Attempt ${attempt} failed:`, submitError.message);
          
          if (attempt < maxRetries) {
            console.log('Retrying in 2 seconds...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      // All retries failed
      throw lastError || new Error('All completion attempts failed');
      
    } catch (err: any) {
      let errorMessage = 'Completion failed. ';
      
      // Provide helpful error messages and recovery options
      if (err.message && err.message.includes('No valid pending deposit')) {
        errorMessage += 'No pending deposit found. Your ETH was sent but may need manual completion.';
      } else if (err.message && err.message.includes('insufficient funds')) {
        errorMessage += 'Insufficient gas funds. Please add ETH to your wallet and try again.';
      } else {
        errorMessage += 'This may be a temporary RPC issue. Your ETH is safe and can be recovered.';
      }
      
      setError(errorMessage);
      console.error('Complete deposit error:', err);
    } finally {
      setLoading(false);
      setGeneratingProof(false);
    }
  };

  const handleSuccessfulCompletion = async (commitment: string, txHash: string) => {
    console.log('🎉 Pure EVM deposit completed successfully!');
    
    // Change to done step since deposit is complete
    setCurrentStep('done');
    
    // Store commitment data securely
    proofService.storeCommitmentData(commitment, pendingDepositData!.secret, pendingDepositData!.nullifier);

    // Save deposit info to localStorage
    const depositInfo = {
      commitment,
      asset: '0', // Native currency
      amount: pendingDepositData!.amountWei,
      txHash: txHash,
      timestamp: Date.now(),
    };

    localStorage.setItem(`deposit_${commitment}`, JSON.stringify(depositInfo));

    // Download commitment data
    const downloadData = {
      commitment,
      secret: pendingDepositData!.secret,
      nullifier: pendingDepositData!.nullifier,
      asset: 'ETH',
      amount: pendingDepositData!.amount,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(downloadData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `innocence-deposit-${commitment.slice(0, 8)}.json`;
    link.click();

    setSuccess(`🎉 Private deposit successful! Commitment: ${commitment}`);
    setCurrentStep('done');
  };

  const resetDeposit = () => {
    setCurrentStep('amount');
    setAmount('');
    setDepositCommitment(null);
    setPendingDepositData(null);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="private-deposit">
      <h2>Pure EVM Private Deposit</h2>
      
      {currentStep === 'amount' && (
        <>
          <p className="deposit-explanation">
            Deposit native currency into the private vault using pure EVM transfers.
          </p>
          
          <div className="deposit-form">
            <div className="form-group">
              <label>Amount (ETH)</label>
              <input
                type="number"
                placeholder="0.001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.001"
                min="0.001"
              />
              <div className="input-hint">
                <div>Minimum: 0.001 ETH</div>
                <div>Using native currency for pure EVM privacy</div>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <button
              className="deposit-btn"
              onClick={handlePrepareDeposit}
              disabled={loading || !amount}
            >
              {loading ? 'Preparing...' : 'Prepare Deposit'}
            </button>
          </div>
        </>
      )}

      {currentStep === 'deposit' && (
        <div className="deposit-form">
          <h3>Step 2: Send ETH to Contract</h3>
          <p>Send {amount} ETH to the contract address to fund your private deposit.</p>
          
          <div className="info-box">
            <p>💰 Amount: {amount} ETH</p>
            <p>🏠 Pure EVM approach - two steps</p>
            <p>📤 First send ETH, then complete with proof</p>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button
            className="deposit-btn"
            onClick={handleSendTokens}
            disabled={loading}
          >
            {loading ? 'Sending ETH...' : 'Send ETH to Contract'}
          </button>
          
          <button
            className="deposit-btn"
            onClick={() => setCurrentStep('complete')}
            style={{ marginTop: '10px', backgroundColor: '#666' }}
          >
            Skip to Complete (if ETH already sent)
          </button>
        </div>
      )}

      {currentStep === 'completing' && (
        <div className="deposit-form">
          <h3>Step 3: Completing Deposit</h3>
          <p>ETH has been sent. Waiting for deposit to be ready for completion...</p>
          
          <div className="info-box">
            <p>⏳ Waiting for blockchain confirmation</p>
            <p>🔍 Checking if deposit can be completed</p>
            <p>📊 This may take a few moments</p>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          
          <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Monitoring deposit status...</p>
          </div>
          
          <button
            className="deposit-btn"
            onClick={() => setCurrentStep('complete')}
            style={{ marginTop: '20px', backgroundColor: '#666' }}
          >
            Force Complete (if ready)
          </button>
        </div>
      )}

      {currentStep === 'complete' && (
        <div className="deposit-form">
          <h3>Step 3: Complete Private Deposit</h3>
          <p>Currency sent successfully! Complete the deposit with zero-knowledge proof.</p>
          
          <div className="info-box">
            <p>🔐 Generating zero-knowledge compliance proof</p>
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
          
          {error && (
            <button
              className="deposit-btn"
              onClick={() => {
                setError(null);
                setSuccess('If completion fails, your ETH is safe. Use emergency recovery if needed.');
              }}
              style={{ marginTop: '10px', backgroundColor: '#ff6b35' }}
            >
              🆘 Emergency Recovery Available
            </button>
          )}
        </div>
      )}

      {currentStep === 'done' && (
        <div className="deposit-form">
          <h3>✅ Deposit Complete!</h3>
          <div className="success-message">{success}</div>
          
          <div className="info-box">
            <p>🎉 Your ETH is now in the private vault</p>
            <p>📄 Keep your downloaded commitment file safe</p>
            <p>🔒 Use it to withdraw privately later</p>
          </div>

          <button
            className="deposit-btn"
            onClick={resetDeposit}
          >
            Make Another Deposit
          </button>
        </div>
      )}

      {currentStep === 'done' && (
        <div className="deposit-form">
          <h3>✅ Pure EVM Deposit Complete!</h3>
          <p>Your deposit has been successfully completed on-chain with zero-knowledge proof.</p>
          
          <div className="info-box">
            <p>🎉 Deposit completed successfully!</p>
            <p>🔐 Commitment stored securely</p>
            <p>📥 Secret file downloaded</p>
            <p>💰 Funds are now privately held in the contract</p>
          </div>

          {success && <div className="success-message">{success}</div>}

          <button
            className="deposit-btn"
            onClick={resetDeposit}
          >
            Make Another Deposit
          </button>
        </div>
      )}
    </div>
  );
}