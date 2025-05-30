import { HyperCoreAsset } from '../types';

// Mock HyperCore assets for testnet
// Token IDs match the testnet precompile expectations
export const mockAssets: HyperCoreAsset[] = [
  {
    assetId: '0', // USDC
    symbol: 'USDC',
    name: 'USD Coin',
    currentPrice: 1.0,
    supportsPrivacy: true,
    isPerp: false,
    decimals: 6,
    minTradeSize: 10, // $10 minimum
  },
  {
    assetId: '1', // BTC spot
    symbol: 'BTC',
    name: 'Bitcoin',
    currentPrice: 50000,
    supportsPrivacy: true,
    isPerp: false,
    decimals: 8,
    minTradeSize: 0.0001, // 0.0001 BTC minimum
  },
  {
    assetId: '2', // ETH spot
    symbol: 'ETH',
    name: 'Ethereum',
    currentPrice: 3000,
    supportsPrivacy: true,
    isPerp: false,
    decimals: 18,
    minTradeSize: 0.001, // 0.001 ETH minimum
  },
  {
    assetId: '0', // BTC perp (perps use different numbering)
    symbol: 'BTC-PERP',
    name: 'Bitcoin Perpetual',
    currentPrice: 50000,
    supportsPrivacy: true,
    isPerp: true,
    decimals: 6,
    minTradeSize: 0.0001, // 0.0001 BTC minimum
  },
  {
    assetId: '1', // ETH perp
    symbol: 'ETH-PERP',
    name: 'Ethereum Perpetual',
    currentPrice: 3000,
    supportsPrivacy: true,
    isPerp: true,
    decimals: 6,
    minTradeSize: 0.001, // 0.001 ETH minimum
  },
];

// Mock compliance certificate for testing
export const generateMockCertificate = (address: string) => {
  return {
    certificateId: `cert_${Date.now()}`,
    signature: '0x' + '00'.repeat(65), // Mock signature
    validUntil: Date.now() + 86400000, // 24 hours
    address,
  };
};