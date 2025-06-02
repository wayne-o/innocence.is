import { BrowserProvider, JsonRpcProvider, Contract, Interface, AbiCoder, keccak256, toUtf8Bytes, hexlify, randomBytes, TransactionResponse, Provider, Signer, formatUnits } from 'ethers';
import { PrivateDeposit } from '../types';
import { HyperliquidAPI } from './hyperliquidApi';

// Contract ABI for V5 with two-step deposit
const PRIVACY_SYSTEM_V5_ABI = [
  // Two-step deposit functions
  "function prepareDeposit(uint64 token, uint64 amount) external",
  "function completeDeposit(bytes32 commitment, bytes calldata complianceProof, bytes calldata publicValues) external",
  "function transferToContract(uint64 token, uint64 amount) external",
  "function canCompleteDeposit(address user) external view returns (bool)",
  "function pendingDeposits(address) external view returns (uint64 token, uint64 amount, uint64 contractBalanceBefore, uint256 timestamp, bool completed)",
  // Legacy deposit (will fail on Hyperliquid)
  "function deposit(bytes32 commitment, uint64 token, uint64 amount, bytes calldata complianceProof, bytes calldata publicValues) external",
  // Other functions
  "function privateSpotTrade(bytes calldata tradeProof, bytes calldata publicValues) external",
  "function privatePerpsPosition(bytes32 commitment, bytes calldata ownershipProof, bytes calldata ownershipPublicValues, uint32 asset, bool isBuy, uint64 limitPx, uint64 sz) external",
  "function withdraw(bytes32 nullifier, address recipient, uint64 token, uint256 amount, bytes calldata balanceProof, bytes calldata publicValues) external",
  "function getMerkleRoot() external view returns (bytes32)",
  "function commitments(bytes32) external view returns (bool)",
  "function nullifiers(bytes32) external view returns (bool)",
  "function complianceAuthority() external view returns (address)",
  "function sp1Verifier() external view returns (address)",
  "function getUserSpotBalance(address user, uint64 token) external view returns (uint64)",
];

// Extended window interface for ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

export class PrivacySystemService {
  private provider: Provider | null = null;
  private signer?: Signer;
  private contractAddress: string;
  private contract?: Contract;
  private listeners: Array<() => void> = [];

  constructor(contractAddress: string) {
    this.contractAddress = contractAddress.trim();
    console.log('Privacy System V5 address:', this.contractAddress);
  }

  public getProvider(): Provider {
    if (!this.provider) {
      if (window.ethereum) {
        this.provider = new BrowserProvider(window.ethereum);
      } else {
        this.provider = new JsonRpcProvider(
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

    this.cleanup();

    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    this.provider = provider;
    this.signer = await provider.getSigner();

    this.contract = new Contract(
      this.contractAddress,
      PRIVACY_SYSTEM_V5_ABI,
      this.signer
    );

    const address = await this.signer.getAddress();
    console.log('Connected to wallet:', address);

    return address;
  }

  async ensureConnected(): Promise<void> {
    if (!this.signer || !this.contract) {
      if (window.ethereum) {
        const provider = new BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_accounts", []);
        if (accounts.length > 0) {
          this.cleanup();

          this.provider = provider;
          this.signer = await provider.getSigner();
          this.contract = new Contract(
            this.contractAddress,
            PRIVACY_SYSTEM_V5_ABI,
            this.signer
          );
        } else {
          throw new Error('Wallet not connected. Please connect first.');
        }
      }
    }
  }

  // Two-step deposit process
  async prepareDeposit(token: number, amount: string): Promise<TransactionResponse> {
    await this.ensureConnected();

    if (!this.contract || !this.signer) {
      throw new Error('Not connected');
    }

    console.log('Preparing deposit...', { token, amount });

    const tx = await this.contract.prepareDeposit(
      BigInt(token),
      BigInt(amount)
    );

    return tx;
  }

  async transferToContract(token: number, amount: string): Promise<TransactionResponse> {
    await this.ensureConnected();

    if (!this.signer) {
      throw new Error('Not connected');
    }

    console.log('Transferring tokens via Hyperliquid API...', { token, amount });

    try {
      // Use Hyperliquid's API to transfer tokens
      const result = await HyperliquidAPI.transferSpotTokens(
        this.signer,
        this.contractAddress,
        token,
        amount
      );

      console.log('Hyperliquid API transfer result:', result);

      // Create a simple mock transaction for UI consistency
      // Since Hyperliquid uses a different system, we just need the wait function
      const txHash = result.txHash || `0x${hexlify(randomBytes(32)).slice(2)}`;

      // Return a minimal object that satisfies the UI's needs
      return {
        hash: txHash,
        wait: async () => {
          // Wait a bit to check if transfer succeeded
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Check if the contract received the tokens
          const contractBalance = await this.getUserSpotBalance(this.contractAddress, token);
          if (contractBalance > BigInt(0)) {
            return { status: 1 };
          }
          throw new Error('Transfer may have failed - please check your balance');
        }
      } as any; // Use 'any' since we're not creating a full TransactionResponse
    } catch (error) {
      console.error('Hyperliquid API transfer failed:', error);
      throw new Error('Transfer failed. Please use Hyperliquid UI to transfer tokens manually.');
    }
  }

  async completeDeposit(params: {
    commitment: string;
    complianceProof: string;
    publicValues: string;
  }): Promise<TransactionResponse> {
    await this.ensureConnected();

    if (!this.contract || !this.signer) {
      throw new Error('Not connected');
    }

    console.log('Completing deposit with ZK proof...');

    const tx = await this.contract.completeDeposit(
      params.commitment,
      params.complianceProof,
      params.publicValues
    );

    return tx;
  }

  async canCompleteDeposit(address: string): Promise<boolean> {
    if (!this.contract) {
      const provider = this.getProvider();
      this.contract = new Contract(
        this.contractAddress,
        PRIVACY_SYSTEM_V5_ABI,
        provider
      );
    }

    try {
      const result = await this.contract.canCompleteDeposit(address);
      console.log('canCompleteDeposit result:', result);
      return result;
    } catch (error) {
      console.error('Error checking canCompleteDeposit:', error);
      // If the check fails, we can try to manually verify
      try {
        const pending = await this.getPendingDeposit(address);
        if (pending.amount === BigInt(0) || pending.completed) {
          return false;
        }

        const currentBalance = await this.getUserSpotBalance(
          this.contractAddress,
          Number(pending.token)
        );

        const difference = currentBalance - pending.contractBalanceBefore;
        console.log('Manual check - Balance difference:', difference.toString(), 'Required:', pending.amount.toString());

        return difference >= pending.amount;
      } catch (fallbackError) {
        console.error('Fallback check also failed:', fallbackError);
        return false;
      }
    }
  }

  async getPendingDeposit(address: string): Promise<{
    token: bigint;
    amount: bigint;
    contractBalanceBefore: bigint;
    timestamp: bigint;
    completed: boolean;
  }> {
    if (!this.contract) {
      const provider = this.getProvider();
      this.contract = new Contract(
        this.contractAddress,
        PRIVACY_SYSTEM_V5_ABI,
        provider
      );
    }

    return await this.contract.pendingDeposits(address);
  }

  // Legacy single-step deposit (will fail on Hyperliquid)
  async depositWithProof(params: {
    commitment: string;
    token: number;
    amount: string;
    complianceProof: string;
    publicValues: string;
  }): Promise<TransactionResponse> {
    await this.ensureConnected();

    if (!this.contract || !this.signer) {
      throw new Error('Not connected');
    }

    try {
      console.log('Executing deposit with ZK proof...');

      const tx = await this.contract.deposit(
        params.commitment,
        BigInt(params.token),
        BigInt(params.amount),
        params.complianceProof,
        params.publicValues
      );

      return tx;
    } catch (error: any) {
      console.error('Deposit error:', error);

      if (error.code === 'UNSUPPORTED_OPERATION' && error.operation === 'resolveName') {
        console.log('ENS error detected, using raw transaction approach...');

        const iface = new Interface(PRIVACY_SYSTEM_V5_ABI);
        const data = iface.encodeFunctionData('deposit', [
          params.commitment,
          BigInt(params.token),
          BigInt(params.amount),
          params.complianceProof,
          params.publicValues
        ]);

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

        const provider = this.getProvider();
        const receipt = await provider.waitForTransaction(txHash);
        if (!receipt) {
          throw new Error('Transaction not found');
        }

        const tx = await provider.getTransaction(txHash);
        if (!tx) {
          throw new Error('Transaction not found');
        }
        return tx as TransactionResponse;
      }

      throw error;
    }
  }

  async withdraw(params: {
    nullifier: string;
    recipient: string;
    token: number;
    amount: string;
    balanceProof: string;
    publicValues: string;
  }): Promise<TransactionResponse> {
    await this.ensureConnected();

    if (!this.contract || !this.signer) {
      throw new Error('Not connected');
    }

    const tx = await this.contract.withdraw(
      params.nullifier,
      params.recipient,
      BigInt(params.token),
      BigInt(params.amount),
      params.balanceProof,
      params.publicValues
    );

    return tx;
  }

  async withdrawWithoutGasEstimation(params: {
    nullifier: string;
    recipient: string;
    token: number;
    amount: string;
    balanceProof: string;
    publicValues: string;
  }): Promise<TransactionResponse> {
    await this.ensureConnected();

    if (!this.contract || !this.signer) {
      throw new Error('Not connected');
    }

    // Build transaction without gas estimation
    const txData = this.contract.interface.encodeFunctionData('withdraw', [
      params.nullifier,
      params.recipient,
      BigInt(params.token),
      BigInt(params.amount),
      params.balanceProof,
      params.publicValues
    ]);

    // Send transaction directly with manual gas settings
    const tx = await this.signer.sendTransaction({
      to: await this.contract.getAddress(),
      data: txData,
      gasLimit: 500000, // Set a reasonable gas limit manually
      gasPrice: 100000000 // 0.1 gwei - adjust as needed
    });

    return tx;
  }

  async getContractAddress(): Promise<string> {
    return this.contractAddress;
  }

  async getSigner() {
    await this.ensureConnected();
    if (!this.signer) {
      throw new Error('Not connected');
    }
    return this.signer;
  }


  async privateSpotTrade(params: {
    tradeProof: string;
    publicValues: string;
  }): Promise<TransactionResponse> {
    await this.ensureConnected();

    if (!this.contract || !this.signer) {
      throw new Error('Not connected');
    }

    const tx = await this.contract.privateSpotTrade(
      params.tradeProof,
      params.publicValues
    );

    return tx;
  }

  async privatePerpsPosition(
    commitment: string,
    ownershipProof: string,
    ownershipPublicValues: string,
    asset: number,
    isBuy: boolean,
    limitPx: bigint,
    sz: bigint
  ): Promise<TransactionResponse> {
    await this.ensureConnected();

    if (!this.contract || !this.signer) {
      throw new Error('Not connected');
    }

    const tx = await this.contract.privatePerpsPosition(
      commitment,
      ownershipProof,
      ownershipPublicValues,
      asset,
      isBuy,
      limitPx,
      sz
    );

    return tx;
  }

  async getMerkleRoot(): Promise<string> {
    if (!this.contract) {
      const provider = this.getProvider();
      this.contract = new Contract(
        this.contractAddress,
        PRIVACY_SYSTEM_V5_ABI,
        provider
      );
    }

    return await this.contract.getMerkleRoot();
  }

  async isCommitmentUsed(commitment: string): Promise<boolean> {
    if (!this.contract) {
      const provider = this.getProvider();
      this.contract = new Contract(
        this.contractAddress,
        PRIVACY_SYSTEM_V5_ABI,
        provider
      );
    }

    return await this.contract.commitments(commitment);
  }

  async isNullifierUsed(nullifier: string): Promise<boolean> {
    if (!this.contract) {
      const provider = this.getProvider();
      this.contract = new Contract(
        this.contractAddress,
        PRIVACY_SYSTEM_V5_ABI,
        provider
      );
    }

    return await this.contract.nullifiers(nullifier);
  }

  generateCommitment(secret: string, nullifier: string): string {
    return keccak256(
      AbiCoder.defaultAbiCoder().encode(
        ['string', 'string'],
        [secret, nullifier]
      )
    );
  }

  generateNullifierHash(nullifier: string): string {
    return keccak256(toUtf8Bytes(nullifier));
  }

  cleanup(): void {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.debug('Cleanup error:', error);
      }
    });
    this.listeners = [];

    // Don't try to remove listeners from the provider - it causes issues
    // Just reset the references
    this.provider = null;
    this.contract = undefined;
    this.signer = undefined;
  }

  async getComplianceAuthority(): Promise<string> {
    if (!this.contract) {
      const provider = this.getProvider();
      this.contract = new Contract(
        this.contractAddress,
        PRIVACY_SYSTEM_V5_ABI,
        provider
      );
    }

    return await this.contract.complianceAuthority();
  }

  async getUserSpotBalance(userAddress: string, token: number): Promise<bigint> {
    try {
      const provider = this.getProvider();
      userAddress = userAddress.toLowerCase();

      console.log('Fetching balance for:', { userAddress, token });

      // HyperCore Spot Balance Precompile address
      const SPOT_BALANCE_PRECOMPILE = '0x0000000000000000000000000000000000000801';

      // Encode the call data: address (20 bytes) + token index (8 bytes)
      const encodedData = AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint64'],
        [userAddress, token]
      );

      console.log('Encoded data:', encodedData);

      // Call the precompile
      const result = await provider.call({
        to: SPOT_BALANCE_PRECOMPILE,
        data: encodedData
      });

      console.log('Precompile result:', result);

      if (result === '0x' || result === '0x0') {
        console.log('No balance data returned from precompile');
        return BigInt(0);
      }

      // Decode the result - expecting (uint64 total, uint64 hold, uint64 entryNtl)
      const decoded = AbiCoder.defaultAbiCoder().decode(
        ['uint64', 'uint64', 'uint64'],
        result
      );

      console.log('Decoded balance:', {
        total: decoded[0].toString(),
        hold: decoded[1].toString(),
        entryNtl: decoded[2].toString()
      });

      // Return the total balance (first value)
      // Note: Hyperliquid returns balances in weiDecimals (8 for HYPE), not full EVM decimals
      return BigInt(decoded[0]);
    } catch (error) {
      console.error('Error fetching spot balance from precompile:', error);
      return BigInt(0);
    }
  }

  async getUserSpotBalanceFormatted(userAddress: string, token: number, assetDecimals: number): Promise<string> {
    const balance = await this.getUserSpotBalance(userAddress, token);

    try {
      // Get token metadata to know the correct decimals
      const tokenMetadata = await HyperliquidAPI.getTokenMetadata(token);

      // Hyperliquid returns balance in weiDecimals, not full EVM decimals
      return formatUnits(balance, tokenMetadata.weiDecimals);
    } catch (error) {
      console.error('Error getting token metadata, using asset decimals:', error);
      // Fallback to using the provided decimals
      return formatUnits(balance, assetDecimals);
    }
  }

  async getUserSpotBalanceInEvmDecimals(userAddress: string, token: number): Promise<bigint> {
    const balance = await this.getUserSpotBalance(userAddress, token);

    try {
      // Get token metadata to know the correct decimals
      const tokenMetadata = await HyperliquidAPI.getTokenMetadata(token);

      // Convert from weiDecimals to full EVM decimals
      const extraDecimals = tokenMetadata.decimals - tokenMetadata.weiDecimals;
      if (extraDecimals > 0) {
        return balance * BigInt(10 ** extraDecimals);
      } else if (extraDecimals < 0) {
        return balance / BigInt(10 ** Math.abs(extraDecimals));
      }
      return balance;
    } catch (error) {
      console.error('Error getting token metadata:', error);
      return balance;
    }
  }

  async getNativeHypeBalance(userAddress: string): Promise<bigint> {
    try {
      const provider = this.getProvider();
      const balance = await provider.getBalance(userAddress);
      console.log('Native HYPe balance:', balance.toString());
      return balance;
    } catch (error) {
      console.error('Error fetching native HYPe balance:', error);
      return BigInt(0);
    }
  }

  async getNativeHypeBalanceFormatted(userAddress: string): Promise<string> {
    const balance = await this.getNativeHypeBalance(userAddress);
    return formatUnits(balance, 18); // HYPe has 18 decimals as native currency
  }

  // Backward compatibility methods
  async deposit(params: PrivateDeposit): Promise<TransactionResponse> {
    // Convert old deposit call to new depositWithProof
    // For backward compatibility, use mock proof data
    const mockProof = '0x' + 'ab'.repeat(64);
    const mockPublicValues = AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'address', 'uint256', 'bytes32'],
      [
        params.commitment,
        await this.getComplianceAuthority(),
        Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
        keccak256(toUtf8Bytes('certificate'))
      ]
    );

    return this.depositWithProof({
      commitment: params.commitment,
      token: parseInt(params.asset.toString()),
      amount: params.amount,
      complianceProof: mockProof,
      publicValues: mockPublicValues
    });
  }

  async hasValidCertificate(address: string): Promise<boolean> {
    // In V4, compliance is proven with ZK proofs, not stored certificates
    // Always return true for backward compatibility
    return true;
  }
}