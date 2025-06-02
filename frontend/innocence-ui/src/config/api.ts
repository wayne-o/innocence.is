// API Configuration
export const getApiUrl = () => {
  const isMainnet = process.env.REACT_APP_NETWORK === 'mainnet';
  return {
    hyperliquid: isMainnet 
      ? 'https://api.hyperliquid.xyz' 
      : 'https://api.hyperliquid-testnet.xyz',
    hyperliquidInfo: isMainnet 
      ? 'https://api.hyperliquid.xyz/info' 
      : 'https://api.hyperliquid-testnet.xyz/info',
    rpc: isMainnet 
      ? 'https://rpc.hyperliquid.xyz/evm' 
      : 'https://rpc.hyperliquid-testnet.xyz/evm',
    explorer: isMainnet 
      ? 'https://explorer.hyperliquid.xyz' 
      : 'https://explorer.hyperliquid-testnet.xyz',
    backend: process.env.REACT_APP_API_URL || 'http://localhost:5169/api'
  };
};

export const isMainnet = () => process.env.REACT_APP_NETWORK === 'mainnet';
export const isTestnet = () => !isMainnet();