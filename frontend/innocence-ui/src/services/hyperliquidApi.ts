import { ExchangeClient, HttpTransport } from '@nktkas/hyperliquid';
import { Signer } from 'ethers';
import { getApiUrl, isTestnet } from '../config/api';

export class HyperliquidAPI {
  private static tokenCache: Map<number, { name: string; tokenId: string; decimals: number; szDecimals: number; weiDecimals: number }> = new Map();
  
  /**
   * Get token metadata from Hyperliquid
   */
  static async getTokenMetadata(tokenIndex: number): Promise<{ name: string; tokenId: string; decimals: number; szDecimals: number; weiDecimals: number }> {
    // Check cache first
    if (this.tokenCache.has(tokenIndex)) {
      return this.tokenCache.get(tokenIndex)!;
    }
    
    try {
      const response = await fetch(getApiUrl().hyperliquidInfo, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'spotMeta'
        })
      });

      const result = await response.json();
      const token = result.tokens?.find((t: any) => t.index === tokenIndex);
      
      if (!token) {
        throw new Error(`Token with index ${tokenIndex} not found`);
      }
      
      const metadata = {
        name: token.name,
        tokenId: token.tokenId,
        decimals: token.weiDecimals + (token.evmContract?.evm_extra_wei_decimals || 0),
        szDecimals: token.szDecimals,
        weiDecimals: token.weiDecimals
      };
      
      // Cache the result
      this.tokenCache.set(tokenIndex, metadata);
      
      return metadata;
    } catch (error) {
      console.error('Error fetching token metadata:', error);
      throw error;
    }
  }
  
  /**
   * Transfer spot tokens using Hyperliquid's API via the @nktkas/hyperliquid SDK
   * This requires the user to sign the request with their wallet
   * @param amount - Amount in weiDecimals (8 decimals) format
   */
  static async transferSpotTokens(
    signer: Signer,
    toAddress: string,
    tokenId: number,
    amount: string
  ): Promise<any> {
    try {
      console.log('Starting Hyperliquid SDK transfer...', { toAddress, tokenId, amount });
      
      // Get the user's address
      const userAddress = await signer.getAddress();
      console.log('User address:', userAddress);
      
      // Check balance first
      const balances = await this.getSpotBalances(userAddress);
      console.log('User balances:', balances);
      
      // Create transport with network configuration
      const transport = new HttpTransport({
        isTestnet: isTestnet()
      });
      
      // Create an ExchangeClient instance
      const client = new ExchangeClient({
        wallet: signer as any, // The SDK accepts ethers v6 signer
        transport,
        isTestnet: isTestnet()
      });

      // Get token metadata
      const tokenMetadata = await this.getTokenMetadata(tokenId);
      
      // Format token parameter as "NAME:0xHEX"
      const tokenParam = `${tokenMetadata.name}:${tokenMetadata.tokenId}` as `${string}:0x${string}`;
      
      // Convert amount from weiDecimals to Hyperliquid format
      // The amount passed in is already in weiDecimals (8 decimals)
      // But Hyperliquid expects the amount in its native format (szDecimals)
      const weiAmount = BigInt(amount);
      
      // For Hyperliquid spot send, amounts must be formatted with szDecimals precision
      // Convert from weiDecimals (8 decimals) to human readable format
      const divisor = Math.pow(10, tokenMetadata.weiDecimals);
      const decimalAmount = Number(weiAmount) / divisor;
      
      // Format with the correct number of decimal places for Hyperliquid
      // IMPORTANT: Hyperliquid uses szDecimals for the format, but we need to ensure
      // we don't round down to 0 for small amounts
      let formattedAmount = decimalAmount.toFixed(tokenMetadata.szDecimals);
      
      // Check if amount rounds to 0 due to szDecimals limitation
      if (parseFloat(formattedAmount) === 0 && decimalAmount > 0) {
        // Calculate minimum transferable amount based on szDecimals
        const minAmount = Math.pow(10, -tokenMetadata.szDecimals);
        console.warn(`Amount ${decimalAmount} rounds to 0 with ${tokenMetadata.szDecimals} decimals. Minimum is ${minAmount}`);
        
        // For HYPE with szDecimals=2, minimum is 0.01
        if (tokenMetadata.name === 'HYPE' && decimalAmount < 0.01) {
          throw new Error(`Minimum transfer amount for HYPE is 0.01 (you tried ${decimalAmount})`);
        }
        
        formattedAmount = minAmount.toFixed(tokenMetadata.szDecimals);
      }
      
      console.log(`Transferring ${formattedAmount} ${tokenMetadata.name} (raw: ${amount}, wei decimals: ${tokenMetadata.weiDecimals}, size decimals: ${tokenMetadata.szDecimals})`);

      // Perform the spot send operation
      const result = await client.spotSend({
        destination: toAddress.toLowerCase() as `0x${string}`, // Hyperliquid requires lowercase addresses
        token: tokenParam,
        amount: formattedAmount
      });

      console.log('Transfer successful:', result);
      return result;
    } catch (error: any) {
      console.error('Hyperliquid SDK transfer error:', error);
      if (error.message?.includes('Insufficient balance')) {
        // Get more detailed balance info
        const userAddress = await signer.getAddress();
        const balances = await this.getSpotBalances(userAddress);
        const tokenMetadata = await this.getTokenMetadata(tokenId);
        const tokenBalance = balances?.find((b: any) => b.token === tokenMetadata.name);
        console.error(`Insufficient balance: User has ${tokenBalance?.hold || 0} ${tokenMetadata.name} but tried to transfer ${amount}`);
        console.error('User balances:', balances);
      }
      throw error;
    }
  }

  /**
   * Get user's spot balances using the SDK
   */
  static async getSpotBalances(address: string): Promise<any> {
    try {
      // For balance queries, we can use the public info endpoint
      const response = await fetch(getApiUrl().hyperliquidInfo, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'spotClearinghouseState',
          user: address.toLowerCase() // Hyperliquid requires lowercase addresses
        })
      });

      const result = await response.json();
      return result.balances || [];
    } catch (error) {
      console.error('Error fetching spot balances:', error);
      return [];
    }
  }
}