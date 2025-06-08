require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Handle private key
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
// Remove 0x prefix if present and ensure it's lowercase
const privateKey = PRIVATE_KEY.toLowerCase().replace(/^0x/, '');

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  networks: {
    hardhat: {
      chainId: 1337
    },
    hyperevm_testnet: {
      url: process.env.HYPEREVM_TESTNET_RPC_URL || "https://rpc.hyperliquid-testnet.xyz/evm",
      chainId: 998,
      accounts: privateKey ? [`0x${privateKey}`] : [],
      gasPrice: 100000000, // 0.1 gwei
    },
    hyperevm_mainnet: {
      url: process.env.HYPEREVM_MAINNET_RPC_URL || "https://rpc.hyperliquid.xyz/evm",
      chainId: 999, // HyperEVM mainnet chain ID
      accounts: privateKey ? [`0x${privateKey}`] : []
    }
  },
  etherscan: {
    apiKey: {
      hyperevm_testnet: "not-needed",
      hyperevm_mainnet: "not-needed"
    }
  }
};