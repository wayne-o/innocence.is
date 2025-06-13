import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { PrivacySystemService } from '../services/blockchain-v4';
import privateDexService, { TOKENS, FEE_TIERS } from '../services/privateDexService';
import './PrivateSwap.css';

interface PrivateSwapProps {
  privacySystem: PrivacySystemService;
  userAddress: string;
  commitment?: string;
  onSwapComplete?: () => void;
}

export function PrivateSwap({ privacySystem, userAddress, commitment, onSwapComplete }: PrivateSwapProps) {
  const [tokenIn, setTokenIn] = useState<string>('');
  const [tokenOut, setTokenOut] = useState<string>('TestUSDC');
  const [amountIn, setAmountIn] = useState<string>('');
  const [amountOut, setAmountOut] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(0.5);
  const [fee, setFee] = useState<number>(FEE_TIERS.MEDIUM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [availableTokens, setAvailableTokens] = useState<{ from: string[], to: string[] }>({ from: [], to: [] });
  const [balances, setBalances] = useState<{ [token: string]: string }>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  useEffect(() => {
    if (commitment) {
      // Load available tokens and balances
      const tokens = privateDexService.getAvailableTokensForSwap(commitment);
      setAvailableTokens(tokens);
      
      // Set default tokenIn if available and not already set
      if (tokens.from.length > 0 && !tokenIn) {
        setTokenIn(tokens.from[0]);
      }
      
      // Load balances and migrate old token names
      const position = localStorage.getItem(`innocence_${commitment}`);
      if (position) {
        const parsed = JSON.parse(position);
        const originalBalances = parsed.balances || {};
        
        // Migrate token names for display
        const migratedBalances: { [token: string]: string } = {};
        const tokenMigrationMap: { [oldToken: string]: string } = {
          'HYPE': 'TestWHYPE',
          'USDC': 'TestUSDC',
          'ETH': 'WETH'
        };
        
        for (const [token, balance] of Object.entries(originalBalances)) {
          const migratedToken = tokenMigrationMap[token] || token;
          migratedBalances[migratedToken] = balance as string;
        }
        
        setBalances(migratedBalances);
      }
    }
  }, [commitment]);
  
  useEffect(() => {
    // Get quote when input changes
    const getQuote = async () => {
      if (amountIn && parseFloat(amountIn) > 0) {
        try {
          const quote = await privateDexService.getQuote(tokenIn, tokenOut, amountIn, fee);
          setAmountOut(quote.amountOut);
        } catch (error) {
          console.error('Failed to get quote:', error);
        }
      } else {
        setAmountOut('');
      }
    };
    
    const debounceTimer = setTimeout(getQuote, 500);
    return () => clearTimeout(debounceTimer);
  }, [amountIn, tokenIn, tokenOut, fee]);
  
  const handleSwap = async () => {
    if (!commitment) {
      setError('No active position found. Please make a deposit first.');
      return;
    }
    
    if (!amountIn || parseFloat(amountIn) <= 0) {
      setError('Enter a valid amount');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Get the DEX extension contract
      const dexExtensionAddress = process.env.REACT_APP_DEX_EXTENSION;
      if (!dexExtensionAddress) {
        throw new Error('DEX extension not configured');
      }
      
      // Get the signer from privacySystem
      const signer = await privacySystem.getSigner();
      
      const result = await privateDexService.executePrivateSwap(signer, {
        commitment,
        tokenIn,
        tokenOut,
        amountIn,
        slippageTolerance: slippage,
        fee
      });
      
      if (result.success) {
        setSuccess(`Swapped ${amountIn} ${tokenIn} for ${result.amountOut} ${tokenOut}`);
        
        // Update local state
        setBalances(result.newPosition.balances);
        setAmountIn('');
        setAmountOut('');
        
        // Callback
        if (onSwapComplete) onSwapComplete();
      } else {
        setError('Swap failed. Please try again.');
      }
    } catch (error: any) {
      setError(error.message || 'Swap failed');
    } finally {
      setLoading(false);
    }
  };
  
  const switchTokens = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn(amountOut);
    setAmountOut(amountIn);
  };
  
  if (!commitment) {
    return (
      <div className="private-swap no-position">
        <p>No active position found.</p>
        <p>Please make a deposit first to start trading privately.</p>
      </div>
    );
  }
  
  return (
    <div className="private-swap">
      <h3>Private Swap</h3>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      {/* From Token */}
      <div className="swap-section">
        <label>From</label>
        <div className="token-input">
          <input
            type="number"
            placeholder="0.0"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            disabled={loading}
          />
          <select 
            value={tokenIn} 
            onChange={(e) => setTokenIn(e.target.value)}
            disabled={loading}
          >
            {availableTokens.from.length === 0 ? (
              <option value="">No tokens available</option>
            ) : (
              availableTokens.from.map(token => (
                <option key={token} value={token}>{token}</option>
              ))
            )}
          </select>
        </div>
        <div className="balance">
          Balance: {balances[tokenIn] || '0'} {tokenIn}
        </div>
      </div>
      
      {/* Swap Direction */}
      <div className="swap-direction">
        <button
          onClick={switchTokens}
          className="switch-btn"
          disabled={loading}
        >
          ↓
        </button>
      </div>
      
      {/* To Token */}
      <div className="swap-section">
        <label>To</label>
        <div className="token-input">
          <input
            type="number"
            placeholder="0.0"
            value={amountOut}
            readOnly
          />
          <select 
            value={tokenOut} 
            onChange={(e) => setTokenOut(e.target.value)}
            disabled={loading}
          >
            {Object.keys(TOKENS).map(token => (
              <option key={token} value={token}>{token}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Advanced Settings */}
      <div className="advanced-settings">
        <button 
          className="toggle-advanced"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          Advanced Settings {showAdvanced ? '▲' : '▼'}
        </button>
        
        {showAdvanced && (
          <div className="settings-content">
            <div className="setting">
              <label>Slippage Tolerance</label>
              <div className="slippage-options">
                {[0.1, 0.5, 1.0].map(value => (
                  <button
                    key={value}
                    onClick={() => setSlippage(value)}
                    className={slippage === value ? 'active' : ''}
                    disabled={loading}
                  >
                    {value}%
                  </button>
                ))}
              </div>
            </div>
            
            <div className="setting">
              <label>Fee Tier</label>
              <select 
                value={fee} 
                onChange={(e) => setFee(parseInt(e.target.value))}
                disabled={loading}
              >
                <option value={FEE_TIERS.LOW}>0.05%</option>
                <option value={FEE_TIERS.MEDIUM}>0.3%</option>
                <option value={FEE_TIERS.HIGH}>1%</option>
              </select>
            </div>
          </div>
        )}
      </div>
      
      {/* Swap Button */}
      <button
        onClick={handleSwap}
        disabled={loading || !amountIn || parseFloat(amountIn) <= 0}
        className="swap-btn"
      >
        {loading ? 'Swapping...' : 'Swap'}
      </button>
      
      {/* Info */}
      <div className="swap-info">
        <p>• Your swap is completely private</p>
        <p>• No connection to your wallet address</p>
        <p>• Update your backup after swapping</p>
      </div>
    </div>
  );
}