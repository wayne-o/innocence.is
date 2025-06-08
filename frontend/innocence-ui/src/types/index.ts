export interface HyperCoreAsset {
  assetId: string;
  symbol: string;
  name: string;
  decimals: number;
  isPerp: boolean;
  currentPrice: number;
  supportsPrivacy: boolean;
  minTradeSize: number;
  address?: string; // ERC20 token address (optional, not needed for native tokens)
  isNative?: boolean; // Whether this is the native currency (HYPE)
  tokenId?: number; // Numeric token ID for the privacy contract
}

export interface ComplianceCheckRequest {
  address: string;
  requestedAmount: number;
  requestedAssets: string[];
  requiresPerps: boolean;
  transactionHash: string;
}

export interface ComplianceCheckResponse {
  isCompliant: boolean;
  certificateId?: string;
  signature?: string;
  reasons: string[];
  validUntil?: string;
}

export interface PrivateDeposit {
  commitment: string;
  asset: string;
  amount: string;
  certificate: string;
  signature: string;
}

export interface PrivateTrade {
  commitment: string;
  proof: string;
  fromAsset: string;
  toAsset: string;
  amount: string;
  minReceived: string;
}

export interface PrivateWithdrawal {
  nullifier: string;
  recipient: string;
  asset: string;
  amount: string;
  proof: string;
}