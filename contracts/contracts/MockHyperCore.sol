// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Mock contracts for local testing without real HyperCore precompiles

contract MockHyperCoreRead {
    mapping(uint256 => uint256) public prices;
    
    constructor() {
        // Set some default prices for testing
        prices[1] = 50000 * 10**8; // BTC at $50,000
        prices[2] = 3000 * 10**8;  // ETH at $3,000
        prices[3] = 100 * 10**8;   // SOL at $100
    }
    
    function getOraclePrice(uint256 asset) external view returns (uint256) {
        return prices[asset] > 0 ? prices[asset] : 100 * 10**8; // Default $100
    }
    
    function getSpotBalance(address user, uint256 asset) external pure returns (uint256) {
        return 0; // Mock implementation
    }
    
    function getVaultEquity(address vault) external pure returns (uint256) {
        return 0; // Mock implementation
    }
    
    function getPerpsPosition(address user, uint256 asset) external pure returns (int256 size, uint256 entryPrice) {
        return (0, 0); // Mock implementation
    }
}

contract MockHyperCoreWrite {
    event MockIOCOrder(uint256 asset, int256 size, bool isBuy, uint256 maxSlippage);
    event MockSpotTransfer(uint256 asset, uint256 amount, address recipient);
    event MockVaultTransfer(address vault, uint256 asset, uint256 amount, bool isDeposit);
    
    function sendIOCOrder(uint256 asset, int256 size, bool isBuy, uint256 maxSlippage) external {
        emit MockIOCOrder(asset, size, isBuy, maxSlippage);
    }
    
    function sendSpot(uint256 asset, uint256 amount, address recipient) external {
        emit MockSpotTransfer(asset, amount, recipient);
    }
    
    function vaultTransfer(address vault, uint256 asset, uint256 amount, bool isDeposit) external {
        emit MockVaultTransfer(vault, asset, amount, isDeposit);
    }
}