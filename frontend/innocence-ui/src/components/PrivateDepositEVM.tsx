import React, { useState, useEffect } from 'react';
import { parseEther, formatEther, parseUnits, formatUnits, ethers } from 'ethers';
import { PrivacySystemService } from '../services/blockchain-v4';
import proofService from '../services/proofService';
import { getNativeCurrencyName, formatCurrencyAmount, getMinimumDepositAmount, getNetworkConfig } from '../utils/network';
import InnocenceProof from './InnocenceProof';
import './PrivateDeposit.css';

interface PrivateDepositEVMProps {
  privacySystem: PrivacySystemService;
  userAddress: string;
}

type DepositStep = 'amount' | 'deposit' | 'completing' | 'complete' | 'done';

export function PrivateDepositEVM({ privacySystem, userAddress }: PrivateDepositEVMProps) {
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<{symbol: string, decimals: number, tokenId: number, isNative: boolean, address?: string}>({
    symbol: 'TestWHYPE',
    decimals: 18,
    tokenId: 0,
    isNative: false,
    address: process.env.REACT_APP_WHYPE_ADDRESS || '0x1eBF615D720041AB0E64112d6dbc2ea9A71abEEa'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatingProof, setGeneratingProof] = useState(false);
  const [currentStep, setCurrentStep] = useState<DepositStep>('amount');
  const [depositCommitment, setDepositCommitment] = useState<string | null>(null);
  const [pendingDepositData, setPendingDepositData] = useState<any>(null);
  const [isInnocent, setIsInnocent] = useState(false);
  const [checkingInnocence, setCheckingInnocence] = useState(true);

  // Check innocence status on mount
  useEffect(() => {
    checkInnocenceStatus();
  }, [userAddress]);

  const checkInnocenceStatus = async () => {
    try {
      setCheckingInnocence(true);
      // In the real system, this would check the smart contract
      // For now, we'll check via the proof service
      const status = await proofService.checkSanctionsStatus(userAddress);
      setIsInnocent(!status.isSanctioned);
    } catch (error) {
      console.error('Error checking innocence:', error);
      setIsInnocent(false);
    } finally {
      setCheckingInnocence(false);
    }
  };

  const handleInnocenceProven = () => {
    setIsInnocent(true);
  };

  // Available tokens based on network
  const availableTokens = React.useMemo(() => {
    const { isTestnet } = getNetworkConfig();
    const tokens: Array<{symbol: string, decimals: number, tokenId: number, isNative: boolean, name: string, address?: string}> = [
      { symbol: 'TestWHYPE', decimals: 18, tokenId: 0, isNative: false, name: 'TestWHYPE Token', address: process.env.REACT_APP_WHYPE_ADDRESS || '0x1eBF615D720041AB0E64112d6dbc2ea9A71abEEa' }
    ];
    
    if (isTestnet) {
      // Note: These still use your custom token contracts for deposits
      // but the UI shows real asset names for consistency
      tokens.push(
        { symbol: 'ETH', decimals: 18, tokenId: 1, isNative: false, name: 'Ethereum (Test)', address: process.env.REACT_APP_TEST_HYPE_ADDRESS },
        { symbol: 'USDC', decimals: 6, tokenId: 2, isNative: false, name: 'USD Coin (Test)', address: process.env.REACT_APP_TEST_USDC_ADDRESS }
      );
    }
    
    return tokens;
  }, []);

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
      setError(`Minimum deposit amount is 0.001 ${selectedToken.symbol}`);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const tokenId = selectedToken.tokenId;
      const amountWei = parseUnits(amount, selectedToken.decimals);
      
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
      setSuccess(`Deposit prepared! Now send ${selectedToken.symbol} to the contract.`);
      
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

      const amountWei = parseUnits(amount, selectedToken.decimals);
      const contractAddress = await privacySystem.getContractAddress();
      const signer = await privacySystem.getSigner();
      
      let tx;
      
      console.log('Selected token:', selectedToken);
      console.log('Is native?', selectedToken.isNative);
      
      if (selectedToken.isNative) {
        // Send native currency directly to the contract
        console.log('Sending native currency to contract:', {
          to: contractAddress,
          value: amountWei.toString()
        });
        
        tx = await signer.sendTransaction({
          to: contractAddress,
          value: amountWei,
          gasLimit: 100000, // Fixed gas - no estimation needed
          gasPrice: 1000000000 // 1 gwei - fixed price
        });
      } else {
        // Transfer ERC20 token to the contract
        if (!selectedToken.address) {
          throw new Error('Token address not found');
        }
        
        console.log('Sending ERC20 token to contract:', {
          token: selectedToken.address,
          to: contractAddress,
          amount: amountWei.toString()
        });
        
        const tokenContract = new ethers.Contract(
          selectedToken.address,
          [
            'function transfer(address to, uint256 amount) external returns (bool)',
            'function approve(address spender, uint256 amount) external returns (bool)',
            'function allowance(address owner, address spender) external view returns (uint256)'
          ],
          signer
        );
        
        // Check allowance first
        const currentAllowance = await tokenContract.allowance(await signer.getAddress(), contractAddress);
        if (currentAllowance < amountWei) {
          console.log('Approving token spend...');
          const approveTx = await tokenContract.approve(contractAddress, amountWei);
          await approveTx.wait();
          console.log('Token approved');
        }
        
        tx = await tokenContract.transfer(contractAddress, amountWei);
      }

      console.log('Send tokens tx:', tx.hash);
      setSuccess(`${selectedToken.symbol} sent! Hash: ${tx.hash} - Waiting for completion readiness...`);
      
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

    // Get the stored commitment data and add balance information
    const storedData = proofService.getCommitmentData(commitment);
    if (storedData) {
      // Update the stored data to include balance information
      const positionData = {
        commitment,
        secret: storedData.secret,
        nullifier: storedData.nullifier,
        timestamp: Date.now(),
        balances: {
          [selectedToken.symbol]: pendingDepositData!.amount // Store the display amount, not wei
        },
        depositAmount: pendingDepositData!.amountWei, // Store the wei amount for DEX initialization
        assetId: 0, // TestWHYPE/native currency is asset 0
        lastUpdated: Date.now()
      };
      
      // Store the updated position with balance
      localStorage.setItem(`innocence_${commitment}`, JSON.stringify(positionData));
    }

    // Save deposit info to localStorage (for record keeping)
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
      asset: selectedToken.symbol,
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

  // Show innocence proof component if not proven
  if (checkingInnocence) {
    return (
      <div className="private-deposit">
        <h2>Checking Innocence Status...</h2>
        <div className="loading">Please wait...</div>
      </div>
    );
  }

  if (!isInnocent) {
    return (
      <div className="private-deposit">
        <InnocenceProof 
          userAddress={userAddress} 
          onInnocenceProven={handleInnocenceProven}
        />
      </div>
    );
  }

  return (
    <div className="private-deposit">
      <h2>Pure EVM Private Deposit</h2>
      
      {currentStep === 'amount' && (
        <>
          <p className="deposit-explanation">
            Deposit tokens into the private vault using pure EVM transfers.
          </p>
          
          <div className="deposit-form">
            {availableTokens.length > 1 && (
              <div className="form-group">
                <label>Token</label>
                <select 
                  value={selectedToken.symbol} 
                  onChange={(e) => {
                    const token = availableTokens.find(t => t.symbol === e.target.value);
                    if (token) setSelectedToken(token);
                  }}
                  className="token-selector"
                >
                  {availableTokens.map(token => (
                    <option key={token.symbol} value={token.symbol}>
                      {token.name} ({token.symbol})
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="form-group">
              <label>Amount ({selectedToken.symbol})</label>
              <input
                type="number"
                placeholder="0.001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.001"
                min="0.001"
              />
              <div className="input-hint">
                <div>Minimum: 0.001 {selectedToken.symbol}</div>
                <div>Using {selectedToken.isNative ? 'native currency' : 'ERC20 token'} for pure EVM privacy</div>
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
          <h3>Step 2: Send {selectedToken.symbol} to Contract</h3>
          <p>Send {amount} {selectedToken.symbol} to the contract address to fund your private deposit.</p>
          
          <div className="info-box">
            <p>💰 Amount: {amount} {selectedToken.symbol}</p>
            <p>🏠 Pure EVM approach - two steps</p>
            <p>📤 First send {selectedToken.symbol}, then complete with proof</p>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button
            className="deposit-btn"
            onClick={handleSendTokens}
            disabled={loading}
          >
            {loading ? `Sending ${selectedToken.symbol}...` : `Send ${selectedToken.symbol} to Contract`}
          </button>
          
          <button
            className="deposit-btn"
            onClick={() => setCurrentStep('complete')}
            style={{ marginTop: '10px', backgroundColor: '#666' }}
          >
            Skip to Complete (if {selectedToken.symbol} already sent)
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

    </div>
  );
}