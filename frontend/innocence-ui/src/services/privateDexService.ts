import { ethers } from 'ethers';
import proofService from './proofService';

// DEX addresses from environment
const SWAP_ROUTER = process.env.REACT_APP_SWAP_ROUTER || '0xA8FAA918701e15c95A6df24DCA0CFB5Bcb1b44B7';
const QUOTER_V2 = process.env.REACT_APP_QUOTER_V2 || '0x373d38df18970470f889b2818C4e10d276fd06eA';

// Token type
interface Token {
  id: number;
  address: string;
  symbol: string;
  decimals: number;
}

// Token mappings for testnet
export const TOKENS: Record<string, Token> = {
  TestWHYPE: { id: 0, address: process.env.REACT_APP_WHYPE_ADDRESS || '0x1eBF615D720041AB0E64112d6dbc2ea9A71abEEa', symbol: 'TestWHYPE', decimals: 18 },
  WETH: { id: 2, address: process.env.REACT_APP_WETH_ADDRESS || '0x64C60400f1eB8F5a5287347075d20061eaf23deb', symbol: 'WETH', decimals: 18 },
  TestUSDC: { id: 3, address: process.env.REACT_APP_USDC_ADDRESS || '0xfC2348222447c85779Eebb46782335cdB5B56303', symbol: 'TestUSDC', decimals: 6 }
};

// Fee tiers
export const FEE_TIERS = {
  LOW: 500,    // 0.05%
  MEDIUM: 3000, // 0.3%
  HIGH: 10000  // 1%
};

interface SwapParams {
  commitment: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippageTolerance: number; // e.g., 0.5 for 0.5%
  fee?: number;
}

interface PrivatePosition {
  commitment: string;
  balances: {
    [tokenSymbol: string]: string;
  };
}

// Token name migration mapping (old name -> new name)
const TOKEN_MIGRATION_MAP: { [oldToken: string]: string } = {
  'HYPE': 'TestWHYPE',
  'USDC': 'TestUSDC',
  'ETH': 'WETH'
};

// Function to migrate old token names to new ones
function migrateTokenName(token: string): string {
  return TOKEN_MIGRATION_MAP[token] || token;
}

class PrivateDexService {
  
  // Initialize DEX balance for a commitment
  async initializeBalance(signer: any, commitment: string): Promise<boolean> {
    try {
      const dexExtensionAddress = process.env.REACT_APP_DEX_EXTENSION;
      if (!dexExtensionAddress) {
        throw new Error('DEX extension not configured');
      }
      
      const { ethers: ethersLib } = await import('ethers');
      
      const dexExtensionABI = [
        'function initializeBalance(bytes32 commitment) external',
        'function getBalances(bytes32 commitment) view returns (uint256[] memory)',
        'function commitmentBalances(bytes32, uint64) view returns (uint256)'
      ];
      
      const dexExtension = new ethersLib.Contract(dexExtensionAddress, dexExtensionABI, signer);
      
      // For the DEX extension, check if balance already exists
      // First check if we can get the commitment balance for asset 0 directly
      try {
        const balance0 = await dexExtension.commitmentBalances(commitment, 0);
        console.log(`Current balance for asset 0: ${balance0.toString()}`);
        
        // If balance is greater than 0, it's already initialized
        if (balance0 > BigInt(0)) {
          console.log('Balance already initialized');
          return true;
        }
      } catch (e: any) {
        console.log('Error checking balance, will try to initialize:', e.message || e);
      }
      
      // Since the privacy system doesn't have a deposits mapping,
      // we need to get the deposit amount from the user's position data
      const storedPosition = localStorage.getItem(`innocence_${commitment}`);
      if (!storedPosition) {
        console.log('No position data found');
        return false;
      }
      
      const position = JSON.parse(storedPosition);
      const depositAmount = position.depositAmount || ethersLib.parseEther('0.1'); // Default to 0.1 ETH
      const assetId = position.assetId || 0; // Default to TestWHYPE (asset 0)
      
      // Initialize the balance
      try {
        console.log(`Initializing DEX balance for asset ${assetId}, amount: ${depositAmount}`);
        
        // Use testnet version with tokenId and amount
        const initABI = ['function initializeBalance(bytes32 commitment, uint64 tokenId, uint256 amount) external'];
        const dexInit = new ethersLib.Contract(dexExtensionAddress, initABI, signer);
        
        const tx = await dexInit.initializeBalance(commitment, assetId, depositAmount);
        await tx.wait();
        console.log('DEX balance initialized successfully');
        
        // Verify the balance was set
        const newBalances = await dexExtension.getBalances(commitment);
        console.log('New balances after init:', newBalances.map((b: any) => b.toString()));
        
        // Update position data with the initialized balance
        position.balances = position.balances || {};
        position.balances['TestWHYPE'] = ethersLib.formatEther(depositAmount);
        localStorage.setItem(`innocence_${commitment}`, JSON.stringify(position));
      } catch (initError) {
        console.error('Error during initialization:', initError);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize balance:', error);
      // Don't throw, just return false so swap can continue
      return false;
    }
  }
  
  // Get quote for swap (doesn't affect privacy)
  async getQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    fee: number = FEE_TIERS.MEDIUM
  ): Promise<{ amountOut: string; priceImpact: number }> {
    // In production, call Quoter V2 contract
    // For now, mock calculation with realistic exchange rates
    
    // Migrate token names for backward compatibility
    const migratedTokenIn = migrateTokenName(tokenIn);
    const migratedTokenOut = migrateTokenName(tokenOut);
    
    const amountInBN = ethers.parseUnits(amountIn, TOKENS[migratedTokenIn].decimals);
    
    // Mock exchange rates (in production, get from oracle/pool)
    // Assume 1 TestWHYPE = $35 (matching pool price), 1 WETH = $3000, 1 TestUSDC = $1
    const mockRates: { [key: string]: number } = {
      TestWHYPE: 35,  // Matching the pool initialization price
      WETH: 3000,
      TestUSDC: 1
    };
    
    // Calculate value in USD
    const valueInUSD = (Number(amountIn) * mockRates[migratedTokenIn]);
    
    // Calculate output amount before fees
    const outputBeforeFees = valueInUSD / mockRates[migratedTokenOut];
    
    // Apply fee (e.g., 0.3% for MEDIUM tier)
    const feeMultiplier = (10000 - (fee / 10)) / 10000; // fee is in basis points
    const outputAfterFees = outputBeforeFees * feeMultiplier;
    
    // Convert to proper decimals
    const amountOutBN = ethers.parseUnits(outputAfterFees.toFixed(TOKENS[migratedTokenOut].decimals), TOKENS[migratedTokenOut].decimals);
    
    return {
      amountOut: ethers.formatUnits(amountOutBN, TOKENS[migratedTokenOut].decimals),
      priceImpact: 0.3 // Mock price impact
    };
  }
  
  // Execute private swap
  async executePrivateSwap(
    signer: any,
    params: SwapParams
  ): Promise<{ 
    success: boolean; 
    amountOut: string; 
    newPosition: PrivatePosition;
    txHash?: string;
  }> {
    try {
      const { commitment, tokenIn, tokenOut, amountIn, slippageTolerance } = params;
      const fee = params.fee || FEE_TIERS.MEDIUM;
      
      // Migrate token names for backward compatibility
      const migratedTokenIn = migrateTokenName(tokenIn);
      const migratedTokenOut = migrateTokenName(tokenOut);
      
      // Get quote
      const quote = await this.getQuote(tokenIn, tokenOut, amountIn, fee);
      const minAmountOut = this.calculateMinAmountOut(quote.amountOut, slippageTolerance, tokenOut);
      
      // Get current position from localStorage
      const currentPosition = this.getStoredPosition(commitment);
      if (!currentPosition) throw new Error('Position not found');
      
      // Verify sufficient balance
      const currentBalance = parseFloat(currentPosition.balances[tokenIn] || '0');
      if (currentBalance < parseFloat(amountIn)) {
        throw new Error('Insufficient balance');
      }
      
      // Import ethers first
      const { ethers: ethersLib } = await import('ethers');
      
      // Generate swap proof
      const amountInWei = ethersLib.parseUnits(amountIn, TOKENS[migratedTokenIn].decimals);
      const minAmountOutWei = ethersLib.parseUnits(minAmountOut, TOKENS[migratedTokenOut].decimals);
      
      // Get balances in wei (handle old token names in stored positions)
      const fromBalanceWei = ethersLib.parseUnits(
        currentPosition.balances[tokenIn] || '0',
        TOKENS[migratedTokenIn].decimals
      );
      const toBalanceWei = ethersLib.parseUnits(
        currentPosition.balances[tokenOut] || '0', 
        TOKENS[migratedTokenOut].decimals
      );
      
      // Get DEX extension contract
      const dexExtensionAddress = process.env.REACT_APP_DEX_EXTENSION;
      if (!dexExtensionAddress) {
        throw new Error('DEX extension not configured');
      }
      
      // Validate signer
      if (!signer || typeof signer.getAddress !== 'function') {
        throw new Error('Invalid signer provided');
      }
      
      // No initialization needed with the new proof-based approach!
      
      // Get the deposited amount from position data
      const depositedAmount = currentPosition.depositAmount || ethersLib.parseEther('0.1');
      
      // Get the current merkle root from the privacy system contract
      const privacySystemAddress = process.env.REACT_APP_PRIVACY_SYSTEM_ADDRESS;
      if (!privacySystemAddress) {
        throw new Error('Privacy system address not configured');
      }
      
      const privacySystemABI = ['function getMerkleRoot() view returns (bytes32)'];
      const privacySystem = new ethersLib.Contract(privacySystemAddress, privacySystemABI, signer);
      const merkleRoot = await privacySystem.getMerkleRoot();
      
      const proofData = await proofService.generateProof('trade', {
        secret: currentPosition.secret,
        nullifier: currentPosition.nullifier,
        fromAsset: TOKENS[tokenIn].id,
        toAsset: TOKENS[tokenOut].id,
        fromAmount: amountInWei.toString(), // Keep as string to avoid overflow
        minToAmount: minAmountOutWei.toString(),
        depositedAmount: depositedAmount.toString(), // Include deposited amount in proof
        fromBalance: fromBalanceWei.toString(),
        toBalance: toBalanceWei.toString(),
        merkleRoot: merkleRoot // Pass the actual merkle root
      });
      
      // Encode the public values for the trade - including deposited amount
      const userAddress = await signer.getAddress();
      const encodedPublicValues = await proofService.encodePublicValues('trade', {
        commitment,
        nullifierHash: ethersLib.keccak256(currentPosition.nullifier),
        fromAsset: TOKENS[tokenIn].id,
        toAsset: TOKENS[tokenOut].id,
        fromAmount: amountInWei.toString(),
        minToAmount: minAmountOutWei.toString(),
        depositedAmount: depositedAmount.toString(), // Include in public values
        merkleRoot: merkleRoot // Use the actual merkle root
      });
      
      // Create DEX extension contract instance
      const dexExtensionABI = [
        'function privateSwap(bytes32 nullifier, bytes calldata proof, bytes calldata publicValues, uint24 fee) external returns (uint256 amountOut)'
      ];
      
      const dexExtension = new ethersLib.Contract(dexExtensionAddress, dexExtensionABI, signer);
      
      // No balance checking needed - the ZK proof verifies everything!
      
      // Generate a unique nullifier for this swap
      const swapNullifier = ethersLib.keccak256(ethersLib.toUtf8Bytes(`${commitment}-${Date.now()}`));
      
      // Extract proof bytes from the proof data
      let proofBytes: string;
      if (proofData.formattedProof) {
        // Use pre-formatted proof from the proof service
        proofBytes = proofData.formattedProof;
      } else if (typeof proofData.proof === 'string') {
        proofBytes = proofData.proof;
      } else if (proofData.proof && proofData.proof.rawBytes) {
        // SP1 proof with rawBytes
        proofBytes = proofData.proof.rawBytes;
      } else {
        // Fallback - format as mock proof for testnet
        console.warn('Using mock proof format for testnet');
        proofBytes = '0x' + '00'.repeat(260); // Mock proof format
      }
      
      // Execute swap on DEX extension
      const tx = await dexExtension.privateSwap(
        swapNullifier,
        proofBytes,
        encodedPublicValues,
        fee
      );
      
      const receipt = await tx.wait();
      
      // Parse swap event to get actual output amount
      const swapEvent = receipt.logs.find((log: any) => 
        log.topics[0] === ethersLib.id("PrivateSwap(bytes32,uint64,uint64,uint256,uint256,uint256)")
      );
      
      const amountOut = swapEvent ? 
        ethersLib.formatUnits(swapEvent.data.slice(130, 194), TOKENS[migratedTokenOut].decimals) : 
        quote.amountOut;
      
      // Update local position
      const newPosition = this.updatePosition(
        currentPosition,
        tokenIn,
        tokenOut,
        amountIn,
        amountOut
      );
      
      // Store updated position
      this.storePosition(newPosition);
      
      return {
        success: true,
        amountOut,
        newPosition,
        txHash: receipt.hash
      };
      
    } catch (error) {
      console.error('Private swap failed:', error);
      return {
        success: false,
        amountOut: '0',
        newPosition: this.getStoredPosition(params.commitment) || {} as PrivatePosition
      };
    }
  }
  
  // Calculate minimum output with slippage
  private calculateMinAmountOut(amountOut: string, slippageTolerance: number, tokenOut: string): string {
    // Parse with correct decimals for the token
    const migratedTokenOut = migrateTokenName(tokenOut);
    const decimals = TOKENS[migratedTokenOut].decimals;
    const amountBN = ethers.parseUnits(amountOut, decimals);
    const slippageBN = BigInt(Math.floor(slippageTolerance * 100));
    const minAmount = (amountBN * (BigInt(10000) - slippageBN)) / BigInt(10000);
    return ethers.formatUnits(minAmount, decimals);
  }
  
  // Get stored position from localStorage
  private getStoredPosition(commitment: string): any {
    const data = localStorage.getItem(`innocence_${commitment}`);
    if (!data) return null;
    return JSON.parse(data);
  }
  
  // Store updated position
  private storePosition(position: any): void {
    localStorage.setItem(`innocence_${position.commitment}`, JSON.stringify(position));
  }
  
  // Update position balances after swap
  private updatePosition(
    position: any,
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    amountOut: string
  ): any {
    const newPosition = { ...position };
    
    // Update balances
    if (!newPosition.balances) newPosition.balances = {};
    
    const currentInBalance = parseFloat(newPosition.balances[tokenIn] || '0');
    const currentOutBalance = parseFloat(newPosition.balances[tokenOut] || '0');
    
    newPosition.balances[tokenIn] = (currentInBalance - parseFloat(amountIn)).toString();
    newPosition.balances[tokenOut] = (currentOutBalance + parseFloat(amountOut)).toString();
    
    // Clean up zero balances
    if (parseFloat(newPosition.balances[tokenIn]) === 0) {
      delete newPosition.balances[tokenIn];
    }
    
    // Update timestamp
    newPosition.lastUpdated = Date.now();
    
    return newPosition;
  }
  
  // Get available tokens for swap based on current position
  getAvailableTokensForSwap(commitment: string): {
    from: string[];
    to: string[];
  } {
    const position = this.getStoredPosition(commitment);
    if (!position || !position.balances) {
      return { from: [], to: [] };
    }
    
    // Migrate old token names in position balances
    const migratedBalances = this.migratePositionBalances(position.balances);
    
    // Tokens with balance can be swapped from
    const from = Object.keys(migratedBalances).filter(token => 
      parseFloat(migratedBalances[token]) > 0
    );
    
    // All supported tokens can be swapped to
    const to = Object.keys(TOKENS);
    
    return { from, to };
  }
  
  // Migrate position balances from old token names to new ones
  private migratePositionBalances(balances: { [token: string]: string }): { [token: string]: string } {
    const migratedBalances: { [token: string]: string } = {};
    
    for (const [token, balance] of Object.entries(balances)) {
      const migratedToken = migrateTokenName(token);
      
      // If we already have a balance for the migrated token, add to it
      if (migratedBalances[migratedToken]) {
        const existing = parseFloat(migratedBalances[migratedToken]);
        const additional = parseFloat(balance);
        migratedBalances[migratedToken] = (existing + additional).toString();
      } else {
        migratedBalances[migratedToken] = balance;
      }
    }
    
    return migratedBalances;
  }
}

export default new PrivateDexService();