import React, { useState, useEffect } from 'react';
import { keccak256, AbiCoder, parseUnits } from 'ethers';
import { HyperCoreAsset } from '../types';
import { PrivacySystemService } from '../services/blockchain-v4';
import { TradingService } from '../services/trading-service';
import proofService from '../services/proofService';
import { AssetSelector } from './AssetSelector';
import './PrivateTrade.css';

interface PrivateTradeProps {
  privacySystem: PrivacySystemService;
  userAddress: string;
}

// Initialize trading service with bridge trading contract
const TRADING_CONTRACT_ADDRESS = '0xc70C375FEb7c9efF3f72AEfBd535C175beDE7d1B';
const tradingService = new TradingService(TRADING_CONTRACT_ADDRESS);

interface StoredCommitment {
  commitment: string;
  secret: string;
  nullifier: string;
  asset: string;
  amount: string;
  timestamp: number;
}

export function PrivateTrade({ privacySystem, userAddress }: PrivateTradeProps) {
  const [tradeType, setTradeType] = useState<'spot' | 'perps'>('spot');
  const [fromAsset, setFromAsset] = useState<HyperCoreAsset | null>(null);
  const [toAsset, setToAsset] = useState<HyperCoreAsset | null>(null);
  const [amount, setAmount] = useState('');
  const [leverage, setLeverage] = useState('1');
  const [isLong, setIsLong] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showFromAssetSelector, setShowFromAssetSelector] = useState(false);
  const [showToAssetSelector, setShowToAssetSelector] = useState(false);
  const [generatingProof, setGeneratingProof] = useState(false);
  const [commitments, setCommitments] = useState<StoredCommitment[]>([]);
  const [selectedCommitment, setSelectedCommitment] = useState<StoredCommitment | null>(null);

  // Load commitments from localStorage
  useEffect(() => {
    const loadedCommitments: StoredCommitment[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('innocence_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '');
          loadedCommitments.push(data);
        } catch (e) {
          console.error('Failed to parse commitment:', e);
        }
      }
    }
    setCommitments(loadedCommitments.sort((a, b) => b.timestamp - a.timestamp));
    if (loadedCommitments.length > 0) {
      setSelectedCommitment(loadedCommitments[0]);
    }
  }, []);

  const handleSpotTrade = async () => {
    if (!fromAsset || !toAsset || !amount || !selectedCommitment) {
      setError('Please fill all fields and select a commitment');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Generate trade proof
      setGeneratingProof(true);
      const minToAmount = parseFloat(amount) * 0.95; // 5% slippage tolerance
      
      const { proofBytes, publicValues } = await proofService.generateTradeProof(
        selectedCommitment.commitment,
        parseInt(fromAsset.assetId),
        parseInt(toAsset.assetId),
        parseFloat(amount),
        minToAmount,
        privacySystem
      );
      setGeneratingProof(false);

      // Execute spot trade
      console.log('Executing spot trade:', {
        fromAsset: fromAsset.symbol,
        toAsset: toAsset.symbol,
        amount
      });

      // Use new trading service instead of old privacySystem
      const tx = await tradingService.privateSpotTrade({
        tradeProof: proofBytes,
        publicValues: publicValues
      });

      console.log('Transaction submitted:', tx.hash);
      
      try {
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt);
        setSuccess(`Trade successful! TX: ${tx.hash}`);
        setAmount('');
        
        // Store trade history for balance tracking
        const tradeHistory = localStorage.getItem(`trades_${selectedCommitment.commitment}`) || '[]';
        const trades = JSON.parse(tradeHistory);
        trades.push({
          type: 'spot',
          fromAsset: parseInt(fromAsset.assetId),
          toAsset: parseInt(toAsset.assetId),
          fromAmount: parseFloat(amount),
          toAmount: minToAmount,
          txHash: tx.hash,
          timestamp: Date.now()
        });
        localStorage.setItem(`trades_${selectedCommitment.commitment}`, JSON.stringify(trades));
      } catch (waitError) {
        console.error('Error waiting for transaction:', waitError);
        setSuccess(`Transaction submitted! TX Hash: ${tx.hash}`);
      }
      
    } catch (err: any) {
      setError(err.message || 'Trade failed');
      console.error('Trade error:', err);
    } finally {
      setLoading(false);
      setGeneratingProof(false);
    }
  };

  const handlePerpsTrade = async () => {
    if (!fromAsset || !amount || !selectedCommitment) {
      setError('Please fill all fields and select a commitment');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // For perps, we need ownership proof
      setGeneratingProof(true);
      
      // Generate ownership proof
      const commitment = selectedCommitment.commitment;
      const commitmentData = proofService.getCommitmentData(commitment);
      
      if (!commitmentData) {
        setError('Commitment data not found');
        return;
      }

      // Generate mock ownership proof
      const ownershipProof = '0x' + 'cd'.repeat(128);
      const nullifierHash = keccak256(commitmentData.nullifier);
      
      const ownershipPublicValues = AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'bytes32'],
        [commitment, nullifierHash]
      );
      
      setGeneratingProof(false);

      // Execute perps trade
      const limitPrice = parseUnits("50000", 8); // $50k for BTC
      const size = parseUnits(amount, 8); // Size in asset units
      
      console.log('Opening perps position:', {
        asset: fromAsset.symbol,
        isLong,
        size: amount,
        leverage
      });

      const tx = await privacySystem.privatePerpsPosition(
        commitment,
        ownershipProof,
        ownershipPublicValues,
        parseInt(fromAsset.assetId),
        isLong,
        limitPrice,
        size
      );

      console.log('Transaction submitted:', tx.hash);
      
      try {
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt);
        setSuccess(`Position opened! TX: ${tx.hash}`);
        setAmount('');
      } catch (waitError) {
        console.error('Error waiting for transaction:', waitError);
        setSuccess(`Transaction submitted! TX Hash: ${tx.hash}`);
      }
      
    } catch (err: any) {
      setError(err.message || 'Trade failed');
      console.error('Trade error:', err);
    } finally {
      setLoading(false);
      setGeneratingProof(false);
    }
  };

  const handleTrade = () => {
    if (tradeType === 'spot') {
      handleSpotTrade();
    } else {
      handlePerpsTrade();
    }
  };

  return (
    <div className="private-trade">
      <h2>Private Trading with ZK Proofs</h2>
      
      <div className="trade-type-selector">
        <button 
          className={tradeType === 'spot' ? 'active' : ''}
          onClick={() => setTradeType('spot')}
        >
          Spot Trading
        </button>
        <button 
          className={tradeType === 'perps' ? 'active' : ''}
          onClick={() => setTradeType('perps')}
        >
          Perpetuals
        </button>
      </div>

      <div className="trade-form">
        <div className="form-group">
          <label>Select Commitment</label>
          <select 
            value={selectedCommitment?.commitment || ''}
            onChange={(e) => {
              const commitment = commitments.find(c => c.commitment === e.target.value);
              setSelectedCommitment(commitment || null);
            }}
          >
            <option value="">Select a commitment</option>
            {commitments.map((c) => (
              <option key={c.commitment} value={c.commitment}>
                {new Date(c.timestamp).toLocaleDateString()} - {c.commitment.slice(0, 10)}...
              </option>
            ))}
          </select>
          {commitments.length === 0 && (
            <div className="hint">Make a deposit first to start trading</div>
          )}
        </div>

        {tradeType === 'spot' ? (
          <>
            <div className="asset-pair">
              <div className="form-group">
                <label>From Asset</label>
                {fromAsset ? (
                  <div className="selected-asset" onClick={() => setShowFromAssetSelector(true)}>
                    <span>{fromAsset.symbol}</span>
                    <span className="change-link">Change</span>
                  </div>
                ) : (
                  <button 
                    className="select-asset-btn"
                    onClick={() => setShowFromAssetSelector(true)}
                  >
                    Select Asset
                  </button>
                )}
              </div>

              <div className="swap-icon">→</div>

              <div className="form-group">
                <label>To Asset</label>
                {toAsset ? (
                  <div className="selected-asset" onClick={() => setShowToAssetSelector(true)}>
                    <span>{toAsset.symbol}</span>
                    <span className="change-link">Change</span>
                  </div>
                ) : (
                  <button 
                    className="select-asset-btn"
                    onClick={() => setShowToAssetSelector(true)}
                  >
                    Select Asset
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="form-group">
              <label>Asset</label>
              {fromAsset ? (
                <div className="selected-asset" onClick={() => setShowFromAssetSelector(true)}>
                  <span>{fromAsset.symbol}</span>
                  <span className="change-link">Change</span>
                </div>
              ) : (
                <button 
                  className="select-asset-btn"
                  onClick={() => setShowFromAssetSelector(true)}
                >
                  Select Asset
                </button>
              )}
            </div>

            <div className="form-group">
              <label>Direction</label>
              <div className="direction-selector">
                <button 
                  className={`long ${isLong ? 'active' : ''}`}
                  onClick={() => setIsLong(true)}
                >
                  Long ↗
                </button>
                <button 
                  className={`short ${!isLong ? 'active' : ''}`}
                  onClick={() => setIsLong(false)}
                >
                  Short ↘
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Leverage</label>
              <input
                type="number"
                placeholder="1"
                value={leverage}
                onChange={(e) => setLeverage(e.target.value)}
                min="1"
                max="50"
              />
              <div className="input-hint">1x - 50x leverage available</div>
            </div>
          </>
        )}

        <div className="form-group">
          <label>Amount</label>
          <input
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {fromAsset && (
            <div className="input-hint">
              Min: {fromAsset.minTradeSize} {fromAsset.symbol}
            </div>
          )}
        </div>

        <div className="info-box">
          <p>🎭 Trade privately without revealing your identity</p>
          <p>📊 Your positions and strategies remain hidden</p>
          <p>🔐 Zero-knowledge proofs ensure complete privacy</p>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <button
          className="trade-btn"
          onClick={handleTrade}
          disabled={loading || !amount || !selectedCommitment || (tradeType === 'spot' ? (!fromAsset || !toAsset) : !fromAsset)}
        >
          {generatingProof ? 'Generating ZK Proof...' : 
           loading ? 'Processing Trade...' : 
           tradeType === 'spot' ? 'Execute Private Trade' : 'Open Private Position'}
        </button>
      </div>

      {showFromAssetSelector && (
        <div className="modal-overlay" onClick={() => setShowFromAssetSelector(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <AssetSelector
              onAssetSelect={(asset) => {
                setFromAsset(asset);
                setShowFromAssetSelector(false);
              }}
              filterPerps={tradeType === 'perps'}
            />
          </div>
        </div>
      )}

      {showToAssetSelector && (
        <div className="modal-overlay" onClick={() => setShowToAssetSelector(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <AssetSelector
              onAssetSelect={(asset) => {
                setToAsset(asset);
                setShowToAssetSelector(false);
              }}
              filterPerps={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}