// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ISP1Verifier.sol";
import "./InnocenceVerificationKeys.sol";

// ========== INTERFACES ==========

interface IDepositContract {
    function commitments(bytes32 commitment) external view returns (bool);
    function getMerkleRoot() external view returns (bytes32);
}

/// @title HyperliquidEVMTrading - Pure EVM Privacy Trading
/// @notice Enables private trading using ZK proofs without external precompiles
/// @dev Works with EVM deposit balances, not L1 Hyperliquid balances
contract HyperliquidEVMTrading {
    
    // ========== STRUCTS ==========
    
    /// @notice Public values for trade authorization proof
    struct TradeProofPublicValues {
        bytes32 commitment;        // User's deposit commitment
        address user;              // Trading user address
        uint32 fromAsset;         // Asset to sell
        uint32 toAsset;           // Asset to buy
        uint256 fromAmount;       // Amount to sell
        uint256 minToAmount;      // Minimum amount to receive
        bytes32 merkleRoot;       // Current merkle root from deposit contract
    }
    
    // ========== STATE VARIABLES ==========
    
    /// @notice SP1 verifier for ZK proofs
    ISP1Verifier public immutable sp1Verifier;
    
    /// @notice Deposit contract for commitment verification
    IDepositContract public immutable depositContract;
    
    /// @notice Track internal balances per commitment per asset
    /// commitment => asset => balance
    mapping(bytes32 => mapping(uint32 => uint256)) public commitmentBalances;
    
    /// @notice Track used commitments to prevent double spending
    mapping(bytes32 => bool) public usedCommitments;
    
    /// @notice Contract owner
    address public owner;
    
    /// @notice Trade counter for unique IDs
    uint256 public tradeCounter;
    
    // ========== EVENTS ==========
    
    event PrivateEVMTrade(
        bytes32 indexed commitment,
        address indexed user,
        uint32 fromAsset,
        uint32 toAsset,
        uint256 fromAmount,
        uint256 toAmount,
        uint256 tradeId,
        uint256 timestamp
    );
    
    // ========== CONSTRUCTOR ==========
    
    constructor(
        address _sp1Verifier,
        address _depositContract
    ) {
        sp1Verifier = ISP1Verifier(_sp1Verifier);
        depositContract = IDepositContract(_depositContract);
        owner = msg.sender;
        tradeCounter = 1;
    }
    
    // ========== MODIFIERS ==========
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    // ========== CORE TRADING FUNCTIONS ==========
    
    /// @notice Initialize commitment balance (call after deposit)
    /// @param commitment The deposit commitment
    /// @param asset Asset ID
    /// @param amount Initial balance amount
    function initializeCommitmentBalance(
        bytes32 commitment,
        uint32 asset,
        uint256 amount
    ) external {
        require(depositContract.commitments(commitment), "Invalid commitment");
        require(!usedCommitments[commitment], "Commitment already used");
        
        // Set initial balance for this commitment
        commitmentBalances[commitment][asset] = amount;
    }
    
    /// @notice Execute pure EVM private trade with ZK proof authorization
    /// @param tradeProof ZK proof of trade authorization
    /// @param publicValues Encoded public values for the proof
    function privateEVMTrade(
        bytes calldata tradeProof,
        bytes calldata publicValues
    ) external returns (uint256 tradeId) {
        // Decode trade parameters
        TradeProofPublicValues memory trade = abi.decode(publicValues, (TradeProofPublicValues));
        
        // Verify user is the caller
        require(trade.user == msg.sender, "Invalid user");
        
        // Verify commitment exists in deposit contract
        require(depositContract.commitments(trade.commitment), "Invalid commitment");
        
        // Verify merkle root matches deposit contract
        require(trade.merkleRoot == depositContract.getMerkleRoot(), "Invalid merkle root");
        
        // Verify the ZK proof for trade authorization
        sp1Verifier.verifyProof(
            InnocenceVerificationKeys.TRADE_VKEY,
            publicValues,
            tradeProof
        );
        
        // Check commitment has sufficient balance for the trade
        uint256 currentBalance = commitmentBalances[trade.commitment][trade.fromAsset];
        require(currentBalance >= trade.fromAmount, "Insufficient commitment balance");
        
        // Calculate received amount (simple 1:1 swap for testing)
        // In production, this would use real price feeds
        uint256 receivedAmount = calculateSwapAmount(trade.fromAsset, trade.toAsset, trade.fromAmount);
        require(receivedAmount >= trade.minToAmount, "Insufficient output amount");
        
        // Execute the trade by updating balances
        commitmentBalances[trade.commitment][trade.fromAsset] -= trade.fromAmount;
        commitmentBalances[trade.commitment][trade.toAsset] += receivedAmount;
        
        // Generate unique trade ID
        tradeId = tradeCounter++;
        
        emit PrivateEVMTrade(
            trade.commitment,
            trade.user,
            trade.fromAsset,
            trade.toAsset,
            trade.fromAmount,
            receivedAmount,
            tradeId,
            block.timestamp
        );
        
        return tradeId;
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    /// @notice Get commitment balance for a specific asset
    /// @param commitment The commitment
    /// @param asset Asset ID
    /// @return balance Current balance
    function getCommitmentBalance(bytes32 commitment, uint32 asset) external view returns (uint256 balance) {
        return commitmentBalances[commitment][asset];
    }
    
    /// @notice Check if a commitment is valid in the deposit contract
    /// @param commitment Commitment to check
    /// @return valid True if commitment exists
    function isCommitmentValid(bytes32 commitment) external view returns (bool valid) {
        return depositContract.commitments(commitment);
    }
    
    /// @notice Get current merkle root from deposit contract
    /// @return root Current merkle root
    function getMerkleRoot() external view returns (bytes32 root) {
        return depositContract.getMerkleRoot();
    }
    
    // ========== INTERNAL FUNCTIONS ==========
    
    /// @notice Calculate swap amount (simplified for testing)
    /// @param fromAsset Asset to sell
    /// @param toAsset Asset to buy  
    /// @param fromAmount Amount to sell
    /// @return toAmount Amount received
    function calculateSwapAmount(
        uint32 fromAsset,
        uint32 toAsset,
        uint256 fromAmount
    ) internal pure returns (uint256 toAmount) {
        // Simple 1:1 swap for testing
        // In production, integrate with real price feeds
        
        if (fromAsset == toAsset) {
            return fromAmount; // Same asset
        }
        
        // Mock exchange rates for testing
        if (fromAsset == 1 && toAsset == 0) {
            // ETH -> USDC (assume ETH = $3000)
            return fromAmount * 3000;
        } else if (fromAsset == 0 && toAsset == 1) {
            // USDC -> ETH 
            return fromAmount / 3000;
        } else {
            // Default 1:1 for other pairs
            return fromAmount;
        }
    }
    
    // ========== ADMIN FUNCTIONS ==========
    
    /// @notice Update contract owner
    /// @param newOwner New owner address
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
    
    /// @notice Emergency function for admin actions
    function emergencyWithdraw() external onlyOwner {
        // Emergency functions if needed
        revert("No emergency action defined");
    }
}