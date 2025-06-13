import React, { useState, useEffect } from 'react';
import { formatUnits } from 'ethers';
import { PrivacySystemService } from '../services/blockchain-v4';
import proofService from '../services/proofService';
import './PrivatePortfolio.css';

interface PrivatePortfolioProps {
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

interface PortfolioAsset {
  assetId: string;
  symbol: string;
  balance: number;
  value: number;
  price: number;
  change24h: number;
  allocation: number;
}

interface Position {
  asset: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

interface Transaction {
  type: 'deposit' | 'withdraw' | 'trade' | 'position';
  asset?: string;
  fromAsset?: string;
  toAsset?: string;
  amount?: number;
  fromAmount?: number;
  toAmount?: number;
  txHash: string;
  timestamp: number;
  side?: string;
}

export function PrivatePortfolio({ privacySystem, userAddress }: PrivatePortfolioProps) {
  const [commitments, setCommitments] = useState<StoredCommitment[]>([]);
  const [selectedCommitment, setSelectedCommitment] = useState<StoredCommitment | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioAsset[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [totalPnL, setTotalPnL] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<'overview' | 'positions' | 'history'>('overview');

  // Mock prices (in production, fetch from oracle)
  const mockPrices: { [key: string]: { price: number; change24h: number } } = {
    '0': { price: 1, change24h: 0 }, // TestWHYPE
    '1': { price: 97000, change24h: 2.5 }, // BTC
    '2': { price: 3800, change24h: 1.8 }, // ETH
    '3': { price: 1.2, change24h: -0.5 }, // ARB
    '4': { price: 42, change24h: 3.2 }, // AVAX
    '5': { price: 620, change24h: 1.1 }, // BNB
    '6': { price: 0.92, change24h: -1.2 }, // MATIC
    '7': { price: 3.5, change24h: 2.1 }, // OP
    '8': { price: 195, change24h: 4.5 }, // SOL
    '9': { price: 2.8, change24h: 6.2 }, // SUI
    '10': { price: 1, change24h: 0 }, // USDC
    '11': { price: 1, change24h: 0 } // USDT
  };

  const assetSymbols: { [key: string]: string } = {
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
    '10': 'TestWHYPE',
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
    '10': 18, // TestWHYPE
    '11': 6   // USDT
  };

  // Load commitments
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

  // Load portfolio when commitment changes
  useEffect(() => {
    if (selectedCommitment) {
      loadPortfolio();
    }
  }, [selectedCommitment]);

  const loadPortfolio = async () => {
    if (!selectedCommitment) return;

    try {
      setLoading(true);

      // Calculate balances from deposits and trades
      const balances: { [key: string]: number } = {};
      const txs: Transaction[] = [];

      // Process deposits
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('deposit_') && key.includes(selectedCommitment.commitment)) {
          try {
            const deposit = JSON.parse(localStorage.getItem(key) || '');
            const assetId = deposit.asset;
            const decimals = assetDecimals[assetId] || 6;
            const amount = parseFloat(formatUnits(deposit.amount, decimals));

            if (!balances[assetId]) balances[assetId] = 0;
            balances[assetId] += amount;

            txs.push({
              type: 'deposit',
              asset: assetId,
              amount,
              txHash: deposit.txHash,
              timestamp: deposit.timestamp
            });
          } catch (e) {
            console.error('Failed to parse deposit:', e);
          }
        }
      }

      // Process trades
      const tradeHistory = localStorage.getItem(`trades_${selectedCommitment.commitment}`);
      if (tradeHistory) {
        const trades = JSON.parse(tradeHistory);
        trades.forEach((trade: any) => {
          const fromAsset = trade.fromAsset.toString();
          const toAsset = trade.toAsset.toString();

          if (balances[fromAsset]) {
            balances[fromAsset] -= trade.fromAmount;
          }

          if (!balances[toAsset]) balances[toAsset] = 0;
          balances[toAsset] += trade.toAmount;

          txs.push({
            type: 'trade',
            fromAsset,
            toAsset,
            fromAmount: trade.fromAmount,
            toAmount: trade.toAmount,
            txHash: trade.txHash,
            timestamp: trade.timestamp
          });
        });
      }

      // Process positions (mock data for demo)
      const positionHistory = localStorage.getItem(`positions_${selectedCommitment.commitment}`);
      if (positionHistory) {
        const posData = JSON.parse(positionHistory);
        const activePositions: Position[] = posData.map((pos: any) => {
          const currentPrice = mockPrices[pos.asset]?.price || 0;
          const pnl = pos.side === 'long'
            ? (currentPrice - pos.entryPrice) * pos.size
            : (pos.entryPrice - currentPrice) * pos.size;
          const pnlPercent = (pnl / (pos.entryPrice * pos.size)) * 100;

          return {
            asset: pos.asset,
            symbol: assetSymbols[pos.asset],
            side: pos.side,
            size: pos.size,
            entryPrice: pos.entryPrice,
            currentPrice,
            pnl,
            pnlPercent
          };
        });
        setPositions(activePositions);
      }

      // Calculate portfolio assets
      let total = 0;
      const assets: PortfolioAsset[] = [];

      Object.entries(balances).forEach(([assetId, balance]) => {
        if (balance > 0.000001) { // Filter dust
          const priceData = mockPrices[assetId] || { price: 0, change24h: 0 };
          const value = balance * priceData.price;
          total += value;

          assets.push({
            assetId,
            symbol: assetSymbols[assetId] || `Asset ${assetId}`,
            balance,
            value,
            price: priceData.price,
            change24h: priceData.change24h,
            allocation: 0 // Will calculate after total
          });
        }
      });

      // Calculate allocations
      assets.forEach(asset => {
        asset.allocation = (asset.value / total) * 100;
      });

      // Sort by value
      assets.sort((a, b) => b.value - a.value);

      // Calculate total PnL from positions
      const totalPositionPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);

      setPortfolio(assets);
      setTotalValue(total);
      setTotalPnL(totalPositionPnL);
      setTransactions(txs.sort((a, b) => b.timestamp - a.timestamp));

    } catch (error) {
      console.error('Failed to load portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatPnL = (value: number) => {
    const formatted = formatValue(Math.abs(value));
    return value >= 0 ? `+${formatted}` : `-${formatted.substring(1)}`;
  };

  return (
    <div className="private-portfolio">
      <h2>Private Portfolio Dashboard</h2>

      <div className="commitment-selector">
        <label>Select Vault</label>
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
      </div>

      {selectedCommitment && (
        <>
          <div className="portfolio-stats">
            <div className="stat-card">
              <h3>Total Value</h3>
              <p className="value">{formatValue(totalValue)}</p>
            </div>
            <div className="stat-card">
              <h3>Open P&L</h3>
              <p className={`value ${totalPnL >= 0 ? 'positive' : 'negative'}`}>
                {formatPnL(totalPnL)}
              </p>
            </div>
            <div className="stat-card">
              <h3>Assets</h3>
              <p className="value">{portfolio.length}</p>
            </div>
            <div className="stat-card">
              <h3>Positions</h3>
              <p className="value">{positions.length}</p>
            </div>
          </div>

          <div className="view-selector">
            <button
              className={activeView === 'overview' ? 'active' : ''}
              onClick={() => setActiveView('overview')}
            >
              Overview
            </button>
            <button
              className={activeView === 'positions' ? 'active' : ''}
              onClick={() => setActiveView('positions')}
            >
              Positions
            </button>
            <button
              className={activeView === 'history' ? 'active' : ''}
              onClick={() => setActiveView('history')}
            >
              History
            </button>
          </div>

          {loading ? (
            <div className="loading">Loading portfolio data...</div>
          ) : (
            <>
              {activeView === 'overview' && (
                <div className="portfolio-overview">
                  <h3>Asset Allocation</h3>
                  <div className="allocation-chart">
                    {portfolio.map((asset) => (
                      <div
                        key={asset.assetId}
                        className="allocation-bar"
                        style={{ width: `${asset.allocation}%` }}
                        title={`${asset.symbol}: ${asset.allocation.toFixed(2)}%`}
                      >
                        <span>{asset.symbol}</span>
                      </div>
                    ))}
                  </div>

                  <h3>Holdings</h3>
                  <table className="holdings-table">
                    <thead>
                      <tr>
                        <th>Asset</th>
                        <th>Balance</th>
                        <th>Price</th>
                        <th>24h</th>
                        <th>Value</th>
                        <th>Allocation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.map((asset) => (
                        <tr key={asset.assetId}>
                          <td>{asset.symbol}</td>
                          <td>{asset.balance.toFixed(6)}</td>
                          <td>{formatValue(asset.price)}</td>
                          <td className={asset.change24h >= 0 ? 'positive' : 'negative'}>
                            {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
                          </td>
                          <td>{formatValue(asset.value)}</td>
                          <td>{asset.allocation.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeView === 'positions' && (
                <div className="positions-view">
                  <h3>Active Positions</h3>
                  {positions.length === 0 ? (
                    <p className="no-data">No active positions</p>
                  ) : (
                    <table className="positions-table">
                      <thead>
                        <tr>
                          <th>Asset</th>
                          <th>Side</th>
                          <th>Size</th>
                          <th>Entry</th>
                          <th>Current</th>
                          <th>P&L</th>
                          <th>P&L %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {positions.map((pos, idx) => (
                          <tr key={idx}>
                            <td>{pos.symbol}</td>
                            <td className={pos.side}>{pos.side.toUpperCase()}</td>
                            <td>{pos.size.toFixed(4)}</td>
                            <td>{formatValue(pos.entryPrice)}</td>
                            <td>{formatValue(pos.currentPrice)}</td>
                            <td className={pos.pnl >= 0 ? 'positive' : 'negative'}>
                              {formatPnL(pos.pnl)}
                            </td>
                            <td className={pos.pnlPercent >= 0 ? 'positive' : 'negative'}>
                              {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeView === 'history' && (
                <div className="history-view">
                  <h3>Transaction History</h3>
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Details</th>
                        <th>Amount</th>
                        <th>Time</th>
                        <th>TX</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx, idx) => (
                        <tr key={idx}>
                          <td className={`tx-type ${tx.type}`}>{tx.type.toUpperCase()}</td>
                          <td>
                            {tx.type === 'deposit' && `${assetSymbols[tx.asset!]} Deposit`}
                            {tx.type === 'trade' && `${assetSymbols[tx.fromAsset!]} → ${assetSymbols[tx.toAsset!]}`}
                            {tx.type === 'position' && `${assetSymbols[tx.asset!]} ${tx.side?.toUpperCase()}`}
                          </td>
                          <td>
                            {tx.type === 'deposit' && `+${tx.amount?.toFixed(6)}`}
                            {tx.type === 'trade' && `${tx.fromAmount?.toFixed(6)} → ${tx.toAmount?.toFixed(6)}`}
                            {tx.type === 'position' && tx.amount?.toFixed(6)}
                          </td>
                          <td>{new Date(tx.timestamp).toLocaleString()}</td>
                          <td>
                            <a
                              href={`https://testnet.purrsec.com/tx/${tx.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="tx-link"
                            >
                              {tx.txHash.slice(0, 8)}...
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <div className="privacy-features">
            <h3>Privacy Features</h3>
            <div className="feature-grid">
              <div className="feature">
                <span className="icon">🔐</span>
                <h4>Hidden Balances</h4>
                <p>Your asset balances are encrypted on-chain</p>
              </div>
              <div className="feature">
                <span className="icon">🎭</span>
                <h4>Anonymous Trading</h4>
                <p>Trade without revealing your identity</p>
              </div>
              <div className="feature">
                <span className="icon">🛡️</span>
                <h4>ZK Proofs</h4>
                <p>Cryptographic proof of ownership without exposure</p>
              </div>
              <div className="feature">
                <span className="icon">📊</span>
                <h4>Private Analytics</h4>
                <p>Track performance without data leaks</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}