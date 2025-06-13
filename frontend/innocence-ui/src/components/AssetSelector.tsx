import React, { useState, useEffect } from 'react';
import { HyperCoreAsset } from '../types';
import { hyperCoreAPI } from '../services/api';
import { getNetworkConfig } from '../utils/network';
import './AssetSelector.css';

interface AssetSelectorProps {
  onAssetSelect: (asset: HyperCoreAsset) => void;
  filterPerps?: boolean;
}

export function AssetSelector({ onAssetSelect, filterPerps = false }: AssetSelectorProps) {
  const [assets, setAssets] = useState<HyperCoreAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    fetchHyperCoreAssets();
  }, []);

  const fetchHyperCoreAssets = async () => {
    try {
      setLoading(true);
      const { isTestnet } = getNetworkConfig();
      
      let assetsData: HyperCoreAsset[];
      
      if (isTestnet) {
        // Use real Hyperliquid testnet assets
        assetsData = [
          {
            symbol: 'USDC',
            name: 'USD Coin',
            assetId: '0',
            decimals: 6,
            isPerp: false,
            supportsPrivacy: true,
            currentPrice: 1.0,
            minTradeSize: 0.01,
            address: '0xeF2224b2032c05C6C7b48355957F3C67191ac81e', // tUSDC address on testnet
            isNative: false,
            tokenId: 1 // Token ID in privacy contract
          },
          {
            symbol: 'ETH',
            name: 'Ethereum',
            assetId: '1',
            decimals: 18,
            isPerp: false,
            supportsPrivacy: true,
            currentPrice: 3000.0,
            minTradeSize: 0.001
          },
          {
            symbol: 'BTC',
            name: 'Bitcoin',
            assetId: '2',
            decimals: 8,
            isPerp: false,
            supportsPrivacy: true,
            currentPrice: 65000.0,
            minTradeSize: 0.0001
          },
          {
            symbol: 'SOL',
            name: 'Solana',
            assetId: '3',
            decimals: 9,
            isPerp: false,
            supportsPrivacy: true,
            currentPrice: 150.0,
            minTradeSize: 0.01
          },
          {
            symbol: 'TestWHYPE',
            name: 'Hyperliquid (Native)',
            assetId: '4',
            decimals: 18,
            isPerp: false,
            supportsPrivacy: true,
            currentPrice: 25.0,
            minTradeSize: 0.1,
            isNative: true,
            tokenId: 0 // Native token ID
          }
        ];
        setUsingMockData(true);
      } else {
        // Use real HyperCore API for mainnet
        assetsData = await hyperCoreAPI.getAssets();
        setUsingMockData(assetsData.length > 0 && assetsData[0].name.includes('(Hyperliquid)'));
      }
      
      const filteredAssets = assetsData.filter(asset => 
        asset.supportsPrivacy && (filterPerps ? !asset.isPerp : true)
      );
      setAssets(filteredAssets);
      
    } catch (err) {
      console.error('Failed to fetch assets:', err);
      setError('Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  const filteredAssets = assets.filter(asset =>
    asset.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="asset-selector-loading">Loading HyperCore assets...</div>;
  if (error) return <div className="asset-selector-error">{error}</div>;

  return (
    <div className="asset-selector">
      {usingMockData && (
        <div className="mock-data-banner">
          ⚠️ Using mock data - Backend not available
        </div>
      )}
      <div className="asset-selector-header">
        <h3>Select HyperCore Asset</h3>
        <input
          type="text"
          placeholder="Search assets..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="asset-search"
        />
      </div>
      
      <div className="asset-grid">
        {filteredAssets.map(asset => (
          <div 
            key={asset.assetId} 
            className="asset-card"
            onClick={() => onAssetSelect(asset)}
          >
            <div className="asset-symbol">{asset.symbol}</div>
            <div className="asset-name">{asset.name}</div>
            <div className="asset-price">${asset.currentPrice.toFixed(4)}</div>
            {asset.isPerp && <div className="perp-badge">PERP</div>}
          </div>
        ))}
      </div>
    </div>
  );
}