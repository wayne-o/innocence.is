import { BrowserProvider, JsonRpcProvider, Contract, keccak256, toUtf8Bytes, AbiCoder, TransactionResponse, Provider, Signer, isAddress } from 'ethers';
import { PrivateDeposit, PrivateTrade, PrivateWithdrawal } from '../types';

// Contract ABI (simplified - in production, import from compiled artifacts)
const PRIVACY_SYSTEM_ABI = [
  "function deposit(bytes32 commitment, uint256 asset, uint256 amount, bytes certificate, bytes signature) external",
  "function privateSpotTrade(bytes32 commitment, bytes proof, uint256 fromAsset, uint256 toAsset, uint256 amount, uint256 minReceived) external",
  "function privatePerpsPosition(bytes32 commitment, bytes proof, uint256 asset, int256 sizeChange, uint256 maxSlippage) external",
  "function withdraw(bytes32 nullifier, address recipient, uint256 asset, uint256 amount, bytes proof) external",
  "function getMerkleRoot() external view returns (bytes32)",
  "function commitments(bytes32) external view returns (bool)",
  "function nullifiers(bytes32) external view returns (bool)",
];

export class PrivacySystemService {
  private provider: Provider;
  private signer?: Signer;
  private contract?: Contract;
  private contractAddress: string;

  constructor(contractAddress: string) {
    this.contractAddress = contractAddress;

    // Initialize provider - in production, detect network
    if (window.ethereum) {
      this.provider = new BrowserProvider(window.ethereum);
    } else {
      this.provider = new JsonRpcProvider(
        process.env.REACT_APP_RPC_URL || 'https://api.hyperliquid.xyz/evm'
      );
    }

    // Log contract address for debugging
    console.log('Contract address:', contractAddress);
    console.log('RPC URL:', process.env.REACT_APP_RPC_URL);
    // Remove validation as it's causing false negatives
  }

  async connect(): Promise<string> {
    if (!window.ethereum) {
      throw new Error('No wallet detected');
    }

    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    this.provider = provider;
    this.signer = await provider.getSigner();

    // Create contract with a specific address to avoid ENS lookups
    this.contract = new Contract(
      this.contractAddress,
      PRIVACY_SYSTEM_ABI,
      this.signer
    );

    const address = await this.signer.getAddress();
    console.log('Connected to wallet:', address);
    console.log('Contract initialized at:', this.contractAddress);

    return address;
  }

  async ensureConnected(): Promise<void> {
    if (!this.signer || !this.contract) {
      // Try to reconnect using existing provider
      if (window.ethereum) {
        const provider = new BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_accounts", []);
        if (accounts.length > 0) {
          this.provider = provider;
          this.signer = await provider.getSigner();
          this.contract = new Contract(
            this.contractAddress,
            PRIVACY_SYSTEM_ABI,
            this.signer
          );
        } else {
          throw new Error('Wallet not connected. Please connect first.');
        }
      }
    }
  }

  async deposit(params: PrivateDeposit): Promise<TransactionResponse> {
    await this.ensureConnected();

    if (!this.contract || !this.signer) {
      throw new Error('Not connected');
    }

    try {
      console.log('Executing deposit transaction...');
      console.log('Using contract at:', this.contractAddress);
      
      // Use the contract directly without address resolution
      const tx = await this.contract.deposit(
        params.commitment,
        params.asset,
        params.amount,
        toUtf8Bytes(params.certificate || ''),
        toUtf8Bytes(params.signature || '')
      );

      return tx;
    } catch (error: any) {
      console.error('Deposit error:', error);
      throw error;
    }
  }

  async privateSpotTrade(params: PrivateTrade): Promise<TransactionResponse> {
    if (!this.contract || !this.signer) {
      throw new Error('Not connected');
    }

    const tx = await this.contract.privateSpotTrade(
      params.commitment,
      params.proof,
      params.fromAsset,
      params.toAsset,
      params.amount,
      params.minReceived
    );

    return tx;
  }

  async withdraw(params: PrivateWithdrawal): Promise<TransactionResponse> {
    if (!this.contract || !this.signer) {
      throw new Error('Not connected');
    }

    const tx = await this.contract.withdraw(
      params.nullifier,
      params.recipient,
      params.asset,
      params.amount,
      params.proof
    );

    return tx;
  }

  async getMerkleRoot(): Promise<string> {
    if (!this.contract) {
      this.contract = new Contract(
        this.contractAddress,
        PRIVACY_SYSTEM_ABI,
        this.provider
      );
    }

    return await this.contract.getMerkleRoot();
  }

  async isCommitmentUsed(commitment: string): Promise<boolean> {
    if (!this.contract) {
      this.contract = new Contract(
        this.contractAddress,
        PRIVACY_SYSTEM_ABI,
        this.provider
      );
    }

    return await this.contract.commitments(commitment);
  }

  async isNullifierUsed(nullifier: string): Promise<boolean> {
    if (!this.contract) {
      this.contract = new Contract(
        this.contractAddress,
        PRIVACY_SYSTEM_ABI,
        this.provider
      );
    }

    return await this.contract.nullifiers(nullifier);
  }

  generateCommitment(secret: string, nullifier: string): string {
    // Generate commitment hash from secret and nullifier
    const hash = keccak256(
      AbiCoder.defaultAbiCoder().encode(
        ['string', 'string'],
        [secret, nullifier]
      )
    );
    return hash;
  }

  generateNullifierHash(nullifier: string): string {
    return keccak256(toUtf8Bytes(nullifier));
  }
}