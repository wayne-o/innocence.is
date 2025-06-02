// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IHyperCoreWrite {
    function sendSpot(address destination, uint64 token, uint64 _wei) external;
}

/**
 * @title HyperliquidTransferHelper
 * @notice Helper contract that users call directly to transfer their tokens
 * @dev This works because when users call this contract, msg.sender is the user
 */
contract HyperliquidTransferHelper {
    IHyperCoreWrite constant HYPERCORE_WRITE = IHyperCoreWrite(0x3333333333333333333333333333333333333333);
    
    event TokensTransferred(address indexed from, address indexed to, uint64 token, uint64 amount);
    
    /**
     * @notice Transfer tokens from caller to destination
     * @dev This works because msg.sender is the user, not a contract
     * @param destination The address to send tokens to
     * @param token The token ID to transfer
     * @param amount The amount to transfer
     */
    function transferTokens(address destination, uint64 token, uint64 amount) external {
        // When user calls this, msg.sender is the user
        // So sendSpot will transfer FROM the user TO the destination
        HYPERCORE_WRITE.sendSpot(destination, token, amount);
        
        emit TokensTransferred(msg.sender, destination, token, amount);
    }
    
    /**
     * @notice Batch transfer multiple tokens
     */
    function batchTransfer(
        address[] calldata destinations,
        uint64[] calldata tokens,
        uint64[] calldata amounts
    ) external {
        require(destinations.length == tokens.length && tokens.length == amounts.length, "Array length mismatch");
        
        for (uint i = 0; i < destinations.length; i++) {
            HYPERCORE_WRITE.sendSpot(destinations[i], tokens[i], amounts[i]);
            emit TokensTransferred(msg.sender, destinations[i], tokens[i], amounts[i]);
        }
    }
}