import React, { useState, useEffect } from 'react';
import { HyperCoreAsset } from '../types';
import { hyperCoreAPI } from '../services/api';
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
      const response = await fetch(process.env.REACT_APP_API_URL + '/hypercore/assets');
      if (!response.ok) {
        throw new Error('Backend not available');
      }
      const assetsData = await response.json();
      const filteredAssets = assetsData.filter((asset: HyperCoreAsset) => 
        asset.supportsPrivacy && (filterPerps ? !asset.isPerp : true)
      );
      setAssets(filteredAssets);
      setUsingMockData(false);
    } catch (err) {
      // If backend is not available, use mock data
      const assetsData = await hyperCoreAPI.getAssets();
      const filteredAssets = assetsData.filter(asset => 
        asset.supportsPrivacy && (filterPerps ? !asset.isPerp : true)
      );
      setAssets(filteredAssets);
      setUsingMockData(true);
      console.log('Using mock data for assets');
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