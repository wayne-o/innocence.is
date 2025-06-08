import { BrowserProvider, Contract, TransactionResponse, Provider, Signer } from 'ethers';

// Bridge Trading contract ABI
const TRADING_CONTRACT_ABI = [
  // Core trading functions
  "function privateBridgeTrade(bytes calldata tradeProof, bytes calldata publicValues) external payable returns (uint256 tradeId)",
  "function initializeCommitmentBalance(bytes32 commitment, uint32 asset, uint256 amount) external",
  "function completeBridgeReturn(bytes32 commitment, uint32 asset, uint256 amount) external",
  
  // View functions
  "function getCommitmentBalance(bytes32 commitment, uint32 asset) external view returns (uint256 balance)",
  "function isCommitmentValid(bytes32 commitment) external view returns (bool valid)",
  "function getMerkleRoot() external view returns (bytes32 root)",
  
  // Contract info
  "function owner() external view returns (address)",
  "function tradeCounter() external view returns (uint256)",
  "function depositContract() external view returns (address)",
  "function sp1Verifier() external view returns (address)"
];

// Extended window interface for ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

export class TradingService {
  private provider: Provider | null = null;
  private signer?: Signer;
  private contractAddress: string;
  private contract?: Contract;

  constructor(contractAddress: string) {
    this.contractAddress = contractAddress.trim();
    console.log('Trading Contract address:', this.contractAddress);
  }

  public getProvider(): Provider {
    if (!this.provider) {
      if (window.ethereum) {
        this.provider = new BrowserProvider(window.ethereum);
      } else {
        // Fallback to Hyperliquid testnet RPC
        throw new Error('No Web3 provider found. Please install MetaMask.');
      }
    }
    return this.provider;
  }

  async ensureConnected(): Promise<void> {
    if (!this.signer) {
      const provider = this.getProvider();
      if (provider instanceof BrowserProvider) {
        await provider.send("eth_requestAccounts", []);
        this.signer = await provider.getSigner();
      }
    }

    if (!this.contract) {
      const provider = this.getProvider();
      this.contract = new Contract(
        this.contractAddress,
        TRADING_CONTRACT_ABI,
        this.signer || provider
      );
    }
  }

  async getSigner(): Promise<Signer> {
    await this.ensureConnected();
    if (!this.signer) {
      throw new Error('No signer available');
    }
    return this.signer;
  }

  async getContractAddress(): Promise<string> {
    return this.contractAddress;
  }

  // ========== TRADING FUNCTIONS ==========

  async privateSpotTrade(params: {
    tradeProof: string;
    publicValues: string;
  }): Promise<TransactionResponse> {
    await this.ensureConnected();

    if (!this.contract || !this.signer) {
      throw new Error('Not connected');
    }

    console.log('Executing private bridge trade via new trading contract...');
    const tx = await this.contract.privateBridgeTrade(
      params.tradeProof,
      params.publicValues
    );

    return tx;
  }

  async privatePerpTrade(params: {
    tradeProof: string;
    publicValues: string;
    reduceOnly?: boolean;
  }): Promise<TransactionResponse> {
    await this.ensureConnected();

    if (!this.contract || !this.signer) {
      throw new Error('Not connected');
    }

    console.log('Executing private perp trade via new trading contract...');
    const tx = await this.contract.privatePerpTrade(
      params.tradeProof,
      params.publicValues,
      params.reduceOnly || false
    );

    return tx;
  }

  // ========== VIEW FUNCTIONS ==========

  async getUserSpotBalance(user: string, coin: number): Promise<string> {
    await this.ensureConnected();

    if (!this.contract) {
      throw new Error('Not connected');
    }

    const balance = await this.contract.getUserSpotBalance(user, coin);
    return balance.toString();
  }

  async getOraclePrice(coin: number): Promise<string> {
    await this.ensureConnected();

    if (!this.contract) {
      throw new Error('Not connected');
    }

    const price = await this.contract.getOraclePrice(coin);
    return price.toString();
  }

  async isCommitmentValid(commitment: string): Promise<boolean> {
    await this.ensureConnected();

    if (!this.contract) {
      throw new Error('Not connected');
    }

    return await this.contract.isCommitmentValid(commitment);
  }

  async getMerkleRoot(): Promise<string> {
    await this.ensureConnected();

    if (!this.contract) {
      throw new Error('Not connected');
    }

    return await this.contract.getMerkleRoot();
  }

  async getTradeNonce(): Promise<string> {
    await this.ensureConnected();

    if (!this.contract) {
      throw new Error('Not connected');
    }

    const nonce = await this.contract.tradeNonce();
    return nonce.toString();
  }

  async getOwner(): Promise<string> {
    await this.ensureConnected();

    if (!this.contract) {
      throw new Error('Not connected');
    }

    return await this.contract.owner();
  }
}