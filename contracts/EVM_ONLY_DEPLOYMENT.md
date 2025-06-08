# Pure EVM Deployment - Clean Architecture

## Summary
We've cleaned up the codebase to focus exclusively on EVM-compatible contracts, removing all Core/L1 integration contracts that were causing confusion.

## Current Deployment (Testnet)

### Privacy System (Pure EVM)
- **Address**: `0x89EaEdC49adEAE838B712Fc9385511c6E8a40470`
- **Contract**: `HyperliquidPrivacySystemEVM`
- **Features**:
  - 100% EVM compatible
  - Native HYPE deposits via `payable` functions
  - ERC20 token support
  - Real SP1 proof verification
  - No Core/L1 dependencies

### SP1 Verifier (Real)
- **Address**: `0x90067a057D526AE2AcD13DfEc655Aa94aAe72693`
- **Type**: SP1VerifierGroth16 from Succinct Labs
- **Status**: Real proof validation (not mock)

## Removed Contracts
All non-EVM contracts have been removed to avoid confusion:
- ❌ HyperliquidPrivacySystem.sol
- ❌ HyperliquidPrivacySystemV3/V4/V5.sol
- ❌ HyperliquidBridgeTrading.sol
- ❌ HyperliquidPrivacyTrading.sol
- ❌ HyperliquidTransferHelper.sol
- ❌ All related deployment scripts and tests

## Remaining EVM Contracts
- ✅ HyperliquidPrivacySystemEVM.sol
- ✅ HyperliquidPrivacySystemEVMWithRecovery.sol
- ✅ HyperliquidEVMTrading.sol

## Key Differences
The pure EVM system:
1. Accepts native HYPE via `payable` functions
2. Works with standard ERC20 tokens
3. No precompile dependencies
4. No Core balance checks
5. Standard Ethereum wallet integration

## Testing
You can now deposit using:
- Native HYPE from your MetaMask wallet
- Standard ERC20 tokens
- Real SP1 proof verification

## Frontend Configuration
```env
REACT_APP_PRIVACY_SYSTEM_ADDRESS=0x89EaEdC49adEAE838B712Fc9385511c6E8a40470
REACT_APP_SP1_VERIFIER_ADDRESS=0x90067a057D526AE2AcD13DfEc655Aa94aAe72693
REACT_APP_PURE_EVM=true
```