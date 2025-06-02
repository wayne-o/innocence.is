import testnetConfig from '../../../../config/testnet.json';
import mainnetConfig from '../../../../config/mainnet.json';

export type NetworkConfig = typeof testnetConfig;

export const NETWORKS = {
  testnet: testnetConfig,
  mainnet: mainnetConfig
} as const;

export type NetworkName = keyof typeof NETWORKS;

// Detect network based on environment
export function getDefaultNetwork(): NetworkName {
  if (process.env.REACT_APP_NETWORK === 'mainnet') {
    return 'mainnet';
  }
  return 'testnet';
}

// Get current network config
export function getNetworkConfig(network?: NetworkName): NetworkConfig {
  const selectedNetwork = network || getDefaultNetwork();
  return NETWORKS[selectedNetwork];
}

// Check if current MetaMask network matches expected
export async function checkNetwork(expectedChainId: number): Promise<boolean> {
  if (!window.ethereum) return false;
  
  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    return parseInt(chainId, 16) === expectedChainId;
  } catch {
    return false;
  }
}

// Switch MetaMask to correct network
export async function switchNetwork(network: NetworkName): Promise<void> {
  if (!window.ethereum) throw new Error('MetaMask not installed');
  
  const config = NETWORKS[network];
  const chainIdHex = `0x${config.network.chainId.toString(16)}`;
  
  try {
    // Try to switch to the network
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (error: any) {
    // Network not added to MetaMask yet
    if (error.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: chainIdHex,
          chainName: config.network.name,
          nativeCurrency: config.network.nativeCurrency,
          rpcUrls: [config.network.rpcUrl],
          blockExplorerUrls: [config.network.explorerUrl],
        }],
      });
    } else {
      throw error;
    }
  }
}