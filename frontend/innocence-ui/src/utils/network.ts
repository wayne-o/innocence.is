// Network and currency utilities

export const getNetworkConfig = () => {
  const network = process.env.REACT_APP_NETWORK || 'mainnet';
  const isTestnet = network === 'testnet';
  
  return {
    network,
    isTestnet,
    nativeCurrency: 'HYPE', // Both mainnet and testnet use HYPE as native currency
    nativeCurrencySymbol: 'HYPE',
    chainId: isTestnet ? 998 : 999,
    rpcUrl: isTestnet 
      ? 'https://rpc.hyperliquid-testnet.xyz/evm'
      : 'https://rpc.hyperliquid.xyz/evm',
    explorerUrl: isTestnet
      ? 'https://explorer.hyperliquid-testnet.xyz'
      : 'https://explorer.hyperliquid.xyz'
  };
};

export const getNativeCurrencyName = (): string => {
  return getNetworkConfig().nativeCurrency;
};

export const formatCurrencyAmount = (amount: string, decimals: number = 18): string => {
  const currency = getNativeCurrencyName();
  return `${amount} ${currency}`;
};

export const getMinimumDepositAmount = (): string => {
  return '0.001'; // Same minimum for both networks
};

export const getTokenInfo = (tokenId: number) => {
  const { isTestnet } = getNetworkConfig();
  
  if (tokenId === 0) {
    return {
      symbol: 'HYPE',
      name: 'Hyperliquid Native',
      decimals: 18,
      isNative: true
    };
  }
  
  if (isTestnet) {
    if (tokenId === 1) {
      return {
        symbol: 'tHYPE',
        name: 'Test HYPE',
        decimals: 18,
        isNative: false,
        address: process.env.REACT_APP_TEST_HYPE_ADDRESS
      };
    }
    if (tokenId === 2) {
      return {
        symbol: 'tUSDC',
        name: 'Test USDC',
        decimals: 6,
        isNative: false,
        address: process.env.REACT_APP_TEST_USDC_ADDRESS
      };
    }
  } else {
    if (tokenId === 1) {
      return {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        isNative: false
      };
    }
  }
  
  return null;
};