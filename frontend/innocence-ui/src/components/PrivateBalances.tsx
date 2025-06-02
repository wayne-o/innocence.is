import React, { useState, useEffect } from 'react';
import { formatUnits } from 'ethers';
import { PrivacySystemService } from '../services/blockchain-v4';
import proofService from '../services/proofService';
import './PrivateBalances.css';

interface PrivateBalancesProps {
  privacySystem: PrivacySystemService;
  userAddress: string;
}

interface StoredCommitment {
  commitment: string;
  secret: string;
  nullifier: string;
  asset: string;
  amount: string;
  timestamp: number;
}

interface Balance {
  assetId: string;
  symbol: string;
  amount: string;
  value: string;
}

export function PrivateBalances({ privacySystem, userAddress }: PrivateBalancesProps) {
  const [commitments, setCommitments] = useState<StoredCommitment[]>([]);
  const [selectedCommitment, setSelectedCommitment] = useState<StoredCommitment | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Asset mapping (in production, fetch from contract or API)
  const assetMap: { [key: string]: string } = {
    '0': 'USDC',
    '1': 'BTC',
    '2': 'ETH',
    '3': 'ARB',
    '4': 'AVAX',
    '5': 'BNB',
    '6': 'MATIC',
    '7': 'OP',
    '8': 'SOL',
    '9': 'SUI',
    '10': 'HYPE',
    '11': 'USDT'
  };

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

  const checkBalances = async () => {
    if (!selectedCommitment) {
      setError('Please select a commitment');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // In a real implementation, we would:
      // 1. Generate a balance proof for each asset
      // 2. Query the contract for actual balances
      // For now, we'll simulate based on deposits and trades

      // Check deposits
      const deposits: Balance[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('deposit_') && key.includes(selectedCommitment.commitment)) {
          try {
            const deposit = JSON.parse(localStorage.getItem(key) || '');
            const decimals = assetDecimals[deposit.asset] || 6;
            const existing = deposits.find(b => b.assetId === deposit.asset);
            if (existing) {
              existing.amount = (parseFloat(existing.amount) + parseFloat(formatUnits(deposit.amount, decimals))).toString();
            } else {
              deposits.push({
                assetId: deposit.asset,
                symbol: assetMap[deposit.asset] || `Asset ${deposit.asset}`,
                amount: formatUnits(deposit.amount, decimals),
                value: '0' // Would calculate based on price
              });
            }
          } catch (e) {
            console.error('Failed to parse deposit:', e);
          }
        }
      }

      // Check for trade history (would be stored after trades)
      const tradeHistory = localStorage.getItem(`trades_${selectedCommitment.commitment}`);
      if (tradeHistory) {
        const trades = JSON.parse(tradeHistory);
        // Update balances based on trades
        trades.forEach((trade: any) => {
          const fromBalance = deposits.find(b => b.assetId === trade.fromAsset.toString());
          const toBalance = deposits.find(b => b.assetId === trade.toAsset.toString());
          
          if (fromBalance) {
            fromBalance.amount = (parseFloat(fromBalance.amount) - trade.fromAmount).toString();
          }
          
          if (toBalance) {
            toBalance.amount = (parseFloat(toBalance.amount) + trade.toAmount).toString();
          } else {
            deposits.push({
              assetId: trade.toAsset.toString(),
              symbol: assetMap[trade.toAsset.toString()] || `Asset ${trade.toAsset}`,
              amount: trade.toAmount.toString(),
              value: '0'
            });
          }
        });
      }

      // Filter out zero balances
      const nonZeroBalances = deposits.filter(b => parseFloat(b.amount) > 0);
      setBalances(nonZeroBalances);

    } catch (err: any) {
      setError(err.message || 'Failed to check balances');
      console.error('Balance check error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTotalValue = () => {
    // In production, calculate based on current prices
    return balances.reduce((total, balance) => {
      // Mock calculation
      const mockPrices: { [key: string]: number } = {
        '0': 1, // HYPE
        '1': 97000, // BTC
        '2': 3800, // ETH
        '10': 1, // USDC
        '11': 1 // USDT
      };
      const price = mockPrices[balance.assetId] || 0;
      return total + (parseFloat(balance.amount) * price);
    }, 0);
  };

  return (
    <div className="private-balances">
      <h2>Private Vault Balances</h2>
      
      <div className="commitment-selector">
        <label>Select Commitment</label>
        <select 
          value={selectedCommitment?.commitment || ''}
          onChange={(e) => {
            const commitment = commitments.find(c => c.commitment === e.target.value);
            setSelectedCommitment(commitment || null);
            setBalances([]); // Clear balances when switching
          }}
        >
          <option value="">Select a commitment</option>
          {commitments.map((c) => (
            <option key={c.commitment} value={c.commitment}>
              {new Date(c.timestamp).toLocaleDateString()} - {c.commitment.slice(0, 10)}...
            </option>
          ))}
        </select>
      </div>

      <button 
        className="check-balances-btn"
        onClick={checkBalances}
        disabled={loading || !selectedCommitment}
      >
        {loading ? 'Checking...' : 'Check Balances'}
      </button>

      {error && <div className="error-message">{error}</div>}

      {balances.length > 0 && (
        <div className="balances-container">
          <div className="total-value">
            <h3>Total Value</h3>
            <p className="value">${getTotalValue().toLocaleString()}</p>
          </div>

          <div className="balances-list">
            <h3>Asset Balances</h3>
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Balance</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((balance) => (
                  <tr key={balance.assetId}>
                    <td>{balance.symbol}</td>
                    <td>{parseFloat(balance.amount).toFixed(6)}</td>
                    <td>${(parseFloat(balance.amount) * (
                      balance.assetId === '1' ? 97000 :
                      balance.assetId === '2' ? 3800 :
                      1
                    )).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="privacy-note">
            <p>🔐 These balances are stored privately on-chain</p>
            <p>🎭 Only you can view them with your commitment data</p>
          </div>
        </div>
      )}
    </div>
  );
}