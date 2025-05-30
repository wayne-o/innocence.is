import { ethers } from 'ethers';
import { PrivateDeposit, PrivateTrade, PrivateWithdrawal } from '../types';

// Contract ABI for V3 (updated to match HyperCore precompile types)
const PRIVACY_SYSTEM_ABI = [
  "function deposit(bytes32 commitment, uint64 token, uint64 amount, bytes certificate, bytes signature) external",
  "function privateSpotTrade(bytes32 commitment, bytes proof, uint64 fromToken, uint64 toToken, uint64 amount, uint64 minReceived) external",
  "function privatePerpsPosition(bytes32 commitment, bytes proof, uint32 asset, bool isBuy, uint64 limitPx, uint64 sz) external",
  "function withdraw(bytes32 nullifier, address recipient, uint64 token, uint64 amount, bytes proof) external",
  "function getMerkleRoot() external view returns (bytes32)",
  "function commitments(bytes32) external view returns (bool)",
  "function nullifiers(bytes32) external view returns (bool)",
  "function validCertificates(address) external view returns (bool)",
  "function complianceAuthority() external view returns (address)",
];

// Extended window interface for ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

export class PrivacySystemService {
  private provider: ethers.Provider | null = null;
  private signer?: ethers.Signer;
  private contractAddress: string;
  private contract?: ethers.Contract;
  private listeners: Array<() => void> = [];

  constructor(contractAddress: string) {
    // Trim any whitespace or newline characters from the address
    this.contractAddress = contractAddress.trim();

    // Don't initialize provider in constructor to avoid subscriber issues
    // Provider will be initialized on first use

    // Log contract address for debugging
    console.log('Contract address:', this.contractAddress);
    console.log('Contract address length:', this.contractAddress.length);
    console.log('RPC URL:', process.env.REACT_APP_RPC_URL);
  }

  private getProvider(): ethers.Provider {
    if (!this.provider) {
      if (window.ethereum) {
        this.provider = new ethers.BrowserProvider(window.ethereum);
      } else {
        this.provider = new ethers.JsonRpcProvider(
          process.env.REACT_APP_RPC_URL || 'https://rpc.hyperliquid-testnet.xyz/evm'
        );
      }
    }
    return this.provider;
  }

  async connect(): Promise<string> {
    if (!window.ethereum) {
      throw new Error('No wallet detected');
    }

    // Clean up any existing provider
    this.cleanup();

    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    this.provider = provider;
    this.signer = await provider.getSigner();

    // Initialize contract
    this.contract = new ethers.Contract(
      this.contractAddress,
      PRIVACY_SYSTEM_ABI,
      this.signer
    );

    const address = await this.signer.getAddress();
    console.log('Connected to wallet:', address);

    return address;
  }

  async ensureConnected(): Promise<void> {
    if (!this.signer || !this.contract) {
      // Try to reconnect using existing provider
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_accounts", []);
        if (accounts.length > 0) {
          // Clean up old provider first
          this.cleanup();
          
          this.provider = provider;
          this.signer = await provider.getSigner();
          this.contract = new ethers.Contract(
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

  async deposit(params: PrivateDeposit): Promise<ethers.TransactionResponse> {
    await this.ensureConnected();
    
    if (!this.contract || !this.signer) {
      throw new Error('Not connected');
    }

    try {
      console.log('Executing deposit transaction...');
      console.log('Using contract at:', this.contractAddress);
      
      // Convert values to uint64 format
      const token = BigInt(params.asset);
      const amount = BigInt(params.amount);
      
      // Use the contract's deposit method directly
      const tx = await this.contract.deposit(
        params.commitment,
        token,
        amount,
        ethers.toUtf8Bytes(params.certificate || ''),
        ethers.toUtf8Bytes(params.signature || '')
      );

      return tx;
    } catch (error: any) {
      console.error('Deposit error:', error);
      
      // If it's an ENS error, try the raw transaction approach
      if (error.code === 'UNSUPPORTED_OPERATION' && error.operation === 'resolveName') {
        console.log('ENS error detected, using raw transaction approach...');
        
        // Encode the function call with uint64 types
        const iface = new ethers.Interface(PRIVACY_SYSTEM_ABI);
        const data = iface.encodeFunctionData('deposit', [
          params.commitment,
          BigInt(params.asset),
          BigInt(params.amount),
          ethers.toUtf8Bytes(params.certificate || ''),
          ethers.toUtf8Bytes(params.signature || '')
        ]);
        
        // Use window.ethereum directly to send transaction
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        const txParams = {
          from: accounts[0],
          to: this.contractAddress,
          data: data,
          gas: '0x7A120', // 500000 in hex
        };
        
        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [txParams],
        });
        
        // Wait for the transaction to be mined and return a proper response
        const provider = this.getProvider();
        const receipt = await provider.waitForTransaction(txHash);
        if (!receipt) {
          throw new Error('Transaction not found');
        }
        
        // Get the transaction details
        const tx = await provider.getTransaction(txHash);
        if (!tx) {
          throw new Error('Transaction not found');
        }
        return tx as ethers.TransactionResponse;
      }
      
      throw error;
    }
  }

  async privateSpotTrade(params: PrivateTrade): Promise<ethers.TransactionResponse> {
    await this.ensureConnected();
    
    if (!this.contract || !this.signer) {
      throw new Error('Not connected');
    }

    const tx = await this.contract.privateSpotTrade(
      params.commitment,
      params.proof,
      BigInt(params.fromAsset),
      BigInt(params.toAsset),
      BigInt(params.amount),
      BigInt(params.minReceived)
    );

    return tx;
  }

  async withdraw(params: PrivateWithdrawal): Promise<ethers.TransactionResponse> {
    await this.ensureConnected();
    
    if (!this.contract || !this.signer) {
      throw new Error('Not connected');
    }

    const tx = await this.contract.withdraw(
      params.nullifier,
      params.recipient,
      BigInt(params.asset),
      BigInt(params.amount),
      params.proof
    );

    return tx;
  }

  async getMerkleRoot(): Promise<string> {
    if (!this.contract) {
      const provider = this.getProvider();
      this.contract = new ethers.Contract(
        this.contractAddress,
        PRIVACY_SYSTEM_ABI,
        provider
      );
    }

    return await this.contract.getMerkleRoot();
  }

  async isCommitmentUsed(commitment: string): Promise<boolean> {
    if (!this.contract) {
      const provider = this.getProvider();
      this.contract = new ethers.Contract(
        this.contractAddress,
        PRIVACY_SYSTEM_ABI,
        provider
      );
    }

    return await this.contract.commitments(commitment);
  }

  async isNullifierUsed(nullifier: string): Promise<boolean> {
    if (!this.contract) {
      const provider = this.getProvider();
      this.contract = new ethers.Contract(
        this.contractAddress,
        PRIVACY_SYSTEM_ABI,
        provider
      );
    }

    return await this.contract.nullifiers(nullifier);
  }

  generateCommitment(secret: string, nullifier: string): string {
    // Generate commitment hash from secret and nullifier
    const hash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['string', 'string'],
        [secret, nullifier]
      )
    );
    return hash;
  }

  generateNullifierHash(nullifier: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(nullifier));
  }
  
  // Clean up any listeners and provider
  cleanup(): void {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        // Ignore cleanup errors
        console.debug('Cleanup error:', error);
      }
    });
    this.listeners = [];
    
    // Clean up provider
    if (this.provider && 'removeAllListeners' in this.provider) {
      try {
        (this.provider as any).removeAllListeners();
      } catch (error) {
        // Ignore provider cleanup errors
        console.debug('Provider cleanup error:', error);
      }
    }
    
    // Reset references
    this.provider = null;
    this.contract = undefined;
    this.signer = undefined;
  }
  
  // Check if user has valid certificate
  async hasValidCertificate(address: string): Promise<boolean> {
    if (!this.contract) {
      const provider = this.getProvider();
      this.contract = new ethers.Contract(
        this.contractAddress,
        PRIVACY_SYSTEM_ABI,
        provider
      );
    }

    return await this.contract.validCertificates(address);
  }
}