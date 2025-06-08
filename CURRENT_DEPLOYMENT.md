# Current Deployment - Hyperliquid Testnet

## Contract Addresses (With Real SP1 Verifier)

### Core Contracts
- **Privacy System**: `0xdDe7C2a318ce8FadcD42ef56B0ef7bb4e0c897aB`
  - Uses real SP1 verifier (validates proofs)
  - Compliance authority: `0x5Bd2F329C50860366c0E6D3b4227a422B66AD203`
  
- **Bridge Trading**: `0xc70C375FEb7c9efF3f72AEfBd535C175beDE7d1B`
  - Enables Core ↔ EVM bridge for real Hyperliquid trading
  
- **SP1 Verifier**: `0x83F27Afb7d436B2089f6D78858e1d81FbaC562FE`
  - Real verifier that validates ZK proofs
  - Not a mock - set to validate proofs

### Configured Tokens
- **Token ID 0**: Native HYPE
- **Token ID 1**: tUSDC (`0xeF2224b2032c05C6C7b48355957F3C67191ac81e`)
- **Token ID 2**: tHYPE (`0xb82Ca57F6Cc814e945eA999C1B0Ce5ECae156082`)

## Frontend Configuration

Update `.env` file:
```env
REACT_APP_PRIVACY_SYSTEM_ADDRESS=0xdDe7C2a318ce8FadcD42ef56B0ef7bb4e0c897aB
REACT_APP_BRIDGE_TRADING_ADDRESS=0xc70C375FEb7c9efF3f72AEfBd535C175beDE7d1B
REACT_APP_SP1_VERIFIER_ADDRESS=0x83F27Afb7d436B2089f6D78858e1d81FbaC562FE
REACT_APP_MOCK_VERIFIER=false
```

## Testing Checklist

1. ✅ Real SP1 verifier deployed
2. ✅ Privacy system deployed with real verifier
3. ✅ Tokens configured in contract
4. ✅ Frontend updated with new addresses
5. ✅ Backend configured with test tokens
6. ⏳ Ready to test deposits with real proof validation

## Important Notes

- The SP1 verifier is **NOT** a mock - it will validate real proofs
- Make sure proof service is running and generating valid proofs
- Mock proof fallbacks in frontend should be removed for production