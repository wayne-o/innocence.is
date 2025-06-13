export const HYPERLIQUID_TESTNET_CONFIG = {
  chainId: '0x3E6', // 998 in hex
  chainName: 'Hyperliquid Testnet',
  rpcUrls: ['https://rpc.hyperliquid-testnet.xyz/evm'],
  nativeCurrency: {
    name: 'TestWHYPE',
    symbol: 'TestWHYPE',
    decimals: 18,
  },
  blockExplorerUrls: ['https://explorer.hyperliquid-testnet.xyz'],
};

export const HYPERLIQUID_MAINNET_CONFIG = {
  chainId: '0x3E7', // 999 in hex
  chainName: 'Hyperliquid',
  rpcUrls: ['https://rpc.hyperliquid.xyz/evm'],
  nativeCurrency: {
    name: 'TestWHYPE',
    symbol: 'TestWHYPE',
    decimals: 18,
  },
  blockExplorerUrls: ['https://explorer.hyperliquid.xyz'],
};

export async function switchToHyperliquidMainnet() {
  if (!window.ethereum) {
    throw new Error('MetaMask not installed');
  }

  try {
    // Try to switch to the chain
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: HYPERLIQUID_MAINNET_CONFIG.chainId }],
    });
  } catch (error: any) {
    // This error code means the chain has not been added to MetaMask
    if (error.code === 4902) {
      try {
        // Add the chain
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [HYPERLIQUID_MAINNET_CONFIG],
        });
      } catch (addError) {
        console.error('Failed to add Hyperliquid Mainnet to MetaMask:', addError);
        throw addError;
      }
    } else {
      console.error('Failed to switch to Hyperliquid Mainnet:', error);
      throw error;
    }
  }
}

export async function switchToHyperliquidTestnet() {
  if (!window.ethereum) {
    throw new Error('MetaMask not installed');
  }

  try {
    // Try to switch to the chain
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: HYPERLIQUID_TESTNET_CONFIG.chainId }],
    });
  } catch (error: any) {
    // This error code means the chain has not been added to MetaMask
    if (error.code === 4902) {
      try {
        // Add the chain
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [HYPERLIQUID_TESTNET_CONFIG],
        });
      } catch (addError) {
        console.error('Failed to add Hyperliquid Testnet to MetaMask:', addError);
        throw addError;
      }
    } else {
      console.error('Failed to switch to Hyperliquid Testnet:', error);
      throw error;
    }
  }
}