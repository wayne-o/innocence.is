// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ISP1Verifier.sol";
import "./InnocenceVerificationKeys.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Hyperliquid Precompile Interfaces (using correct method signatures)
interface ISpotBalancePrecompile {
    function spotBalance(address user, uint32 coin) external view returns (uint64);
}

interface IOraclePxPrecompile {
    function oraclePx(uint32 index) external view returns (uint64);
}

interface IHyperCoreWrite {
    // Note: Write precompile addresses and methods need to be verified
    // These may not exist or have different signatures
    function sendSpot(address to, uint32 coin, uint64 amount) external returns (bool);
    function spotTrade(uint32 coin, bool isBuy, uint64 limitPx, uint64 sz, uint64 cloid) external returns (bool);
}

/// @notice Pure EVM Privacy System - no L1 integration
/// @dev Handles EVM tokens directly without cross-chain complexity
contract HyperliquidPrivacySystemEVM {
    
    ISP1Verifier public sp1Verifier;
    address public complianceAuthority;
    address public owner;
    address public dexExtension;
    
    // EVM token mappings (token ID → ERC20 address)
    mapping(uint64 => address) public tokenAddresses;
    
    // Privacy system state
    mapping(bytes32 => bool) public commitments;
    mapping(bytes32 => bool) public nullifiers;
    bytes32[] public commitmentMerkleTree;
    
    // Deposit tracking
    struct PendingDeposit {
        uint64 token;
        uint256 amount; // Use uint256 for EVM compatibility
        uint256 contractBalanceBefore;
        uint256 timestamp;
        bool completed;
    }
    mapping(address => PendingDeposit) public pendingDeposits;
    
    // Hyperliquid Precompile Addresses (correct addresses)
    ISpotBalancePrecompile constant SPOT_BALANCE = ISpotBalancePrecompile(0x0000000000000000000000000000000000000801);
    IOraclePxPrecompile constant ORACLE_PX = IOraclePxPrecompile(0x0000000000000000000000000000000000000807);
    IHyperCoreWrite constant HYPERCORE_WRITE = IHyperCoreWrite(0x3333333333333333333333333333333333333333); // Write system contract

    // Events
    event PrivateDeposit(bytes32 indexed commitment, uint256 timestamp);
    event PrivateWithdraw(bytes32 indexed nullifier, uint256 timestamp);
    event PrivateSpotTrade(address indexed user, uint32 coin, bool isBuy, uint64 sz, uint256 timestamp);
    event TokenAdded(uint64 indexed tokenId, address tokenAddress);
    
    // ZK proof structures
    struct BalanceProofPublicValues {
        bytes32 commitment;
        bytes32 merkleRoot;
        uint256 minBalance;
        uint64 assetId;
    }
    
    struct ComplianceProofPublicValues {
        bytes32 commitment;
        address complianceAuthority;
        uint256 validUntil;
        bytes32 certificateHash;
    }

    struct TradeProofPublicValues {
        address user;
        uint32 coin;
        bool isBuy;
        uint64 limitPx;
        uint64 sz;
        uint64 minBalance;
        bytes32 merkleRoot;
    }
    
    constructor(
        address _sp1Verifier,
        address _complianceAuthority
    ) {
        sp1Verifier = ISP1Verifier(_sp1Verifier);
        complianceAuthority = _complianceAuthority;
        owner = msg.sender;
        
        // Token addresses will be set after deployment
        // Token 0 will be TestWHYPE (ERC20), not native ETH
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    /// @notice Add ERC20 token support
    function addToken(uint64 tokenId, address tokenAddress) external {
        require(msg.sender == complianceAuthority, "Only compliance authority");
        tokenAddresses[tokenId] = tokenAddress;
        emit TokenAdded(tokenId, tokenAddress);
    }
    
    /// @notice Prepare deposit (EVM-only)
    function prepareDeposit(uint64 token, uint256 amount) external {
        require(tokenAddresses[token] != address(0) || token == 0, "Token not supported");
        require(amount > 0, "Amount must be positive");
        
        // Get current contract balance
        uint256 balanceBefore = _getTokenBalance(token);
        
        pendingDeposits[msg.sender] = PendingDeposit({
            token: token,
            amount: amount,
            contractBalanceBefore: balanceBefore,
            timestamp: block.timestamp,
            completed: false
        });
    }
    
    /// @notice Check if deposit can be completed (internal)
    function _canCompleteDeposit(address user) internal view returns (bool) {
        PendingDeposit memory deposit = pendingDeposits[user];
        if (deposit.completed || deposit.timestamp == 0) return false;
        
        uint256 currentBalance = _getTokenBalance(deposit.token);
        uint256 expectedIncrease = deposit.amount;
        uint256 actualIncrease = currentBalance - deposit.contractBalanceBefore;
        
        // Allow for small discrepancies (rounding, etc.)
        uint256 tolerance = expectedIncrease / 100; // 1% tolerance
        return actualIncrease >= (expectedIncrease - tolerance);
    }
    
    /// @notice Complete deposit with ZK proof
    function completeDeposit(
        bytes32 commitment,
        bytes calldata complianceProof,
        bytes calldata publicValues
    ) external virtual {
        require(_canCompleteDeposit(msg.sender), "No valid pending deposit");
        require(!commitments[commitment], "Commitment already used");
        
        // Verify compliance proof
        ComplianceProofPublicValues memory compliance = abi.decode(publicValues, (ComplianceProofPublicValues));
        require(compliance.commitment == commitment, "Commitment mismatch");
        require(compliance.complianceAuthority == complianceAuthority, "Invalid authority");
        require(compliance.validUntil > block.timestamp, "Certificate expired");
        
        sp1Verifier.verifyProof(
            InnocenceVerificationKeys.COMPLIANCE_VKEY,
            publicValues,
            complianceProof
        );
        
        // Add commitment to merkle tree
        commitments[commitment] = true;
        commitmentMerkleTree.push(commitment);
        
        // Mark deposit as completed
        pendingDeposits[msg.sender].completed = true;
        
        emit PrivateDeposit(commitment, block.timestamp);
    }
    
    /// @notice Withdraw tokens with ZK proof (Pure EVM)
    function withdraw(
        bytes32 nullifier,
        address recipient,
        uint64 token,
        uint256 amount, // Use uint256 for EVM compatibility
        bytes calldata balanceProof,
        bytes calldata publicValues
    ) external {
        require(!nullifiers[nullifier], "Nullifier already used");
        require(tokenAddresses[token] != address(0) || token == 0, "Token not supported");
        
        // Decode and verify balance proof
        BalanceProofPublicValues memory balance = abi.decode(publicValues, (BalanceProofPublicValues));
        require(balance.merkleRoot == getMerkleRoot(), "Invalid merkle root");
        require(balance.minBalance >= amount, "Insufficient proven balance");
        require(balance.assetId == token, "Asset mismatch");
        
        // Verify the ZK proof
        sp1Verifier.verifyProof(
            InnocenceVerificationKeys.BALANCE_VKEY,
            publicValues,
            balanceProof
        );
        
        nullifiers[nullifier] = true;
        
        // Transfer tokens directly on EVM (no L1 integration)
        _transferTokens(token, recipient, amount);
        
        emit PrivateWithdraw(nullifier, block.timestamp);
    }
    
    /// @notice Execute private spot trade using Hyperliquid precompiles
    function privateSpotTrade(
        bytes calldata tradeProof,
        bytes calldata publicValues
    ) external {
        // Decode trade parameters
        TradeProofPublicValues memory trade = abi.decode(publicValues, (TradeProofPublicValues));
        require(trade.user == msg.sender, "Invalid user");
        require(trade.merkleRoot == getMerkleRoot(), "Invalid merkle root");
        
        // Verify the ZK proof for balance and trade authorization
        sp1Verifier.verifyProof(
            InnocenceVerificationKeys.BALANCE_VKEY, // Using balance vkey for trade authorization
            publicValues,
            tradeProof
        );
        
        // Get current spot balance to verify sufficient funds
        uint64 currentBalance = SPOT_BALANCE.spotBalance(msg.sender, trade.coin);
        require(currentBalance >= trade.minBalance, "Insufficient balance for trade");
        
        // Get current oracle price for validation (optional sanity check)
        uint64 oraclePx = ORACLE_PX.oraclePx(trade.coin);
        require(oraclePx > 0, "Invalid oracle price");
        
        // Execute the spot trade via precompile
        // Generate unique client order ID using block timestamp and user
        uint64 cloid = uint64(uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, trade.coin))));
        
        bool success = HYPERCORE_WRITE.spotTrade(
            trade.coin,
            trade.isBuy,
            trade.limitPx,
            trade.sz,
            cloid
        );
        
        require(success, "Spot trade execution failed");
        
        emit PrivateSpotTrade(trade.user, trade.coin, trade.isBuy, trade.sz, block.timestamp);
    }
    
    /// @notice Get contract's token balance
    function _getTokenBalance(uint64 token) internal view returns (uint256) {
        // All tokens are ERC20 on testnet, including token 0 (TestWHYPE)
        address tokenAddress = tokenAddresses[token];
        if (tokenAddress == address(0)) return 0;
        
        // Call ERC20 balanceOf
        (bool success, bytes memory data) = tokenAddress.staticcall(
            abi.encodeWithSignature("balanceOf(address)", address(this))
        );
        if (success && data.length >= 32) {
            return abi.decode(data, (uint256));
        }
        return 0;
    }
    
    /// @notice Transfer tokens to recipient
    function _transferTokens(uint64 token, address recipient, uint256 amount) internal {
        // All tokens are ERC20 on testnet
        address tokenAddress = tokenAddresses[token];
        require(tokenAddress != address(0), "Token not supported");
        
        (bool success, ) = tokenAddress.call(
            abi.encodeWithSignature("transfer(address,uint256)", recipient, amount)
        );
        require(success, "Token transfer failed");
    }
    
    /// @notice Get merkle root for proof generation
    function getMerkleRoot() public view returns (bytes32) {
        if (commitmentMerkleTree.length == 0) {
            return bytes32(0);
        }
        
        // Simple merkle root calculation
        bytes32 root = commitmentMerkleTree[0];
        for (uint256 i = 1; i < commitmentMerkleTree.length; i++) {
            root = keccak256(abi.encodePacked(root, commitmentMerkleTree[i]));
        }
        return root;
    }
    
    /// @notice Check if deposit can be completed (public)
    function canCompleteDeposit(address user) external view returns (bool) {
        return _canCompleteDeposit(user);
    }
    
    /// @notice Get pending deposit
    function getPendingDeposit(address user) external view returns (PendingDeposit memory) {
        return pendingDeposits[user];
    }
    
    /// @notice Set DEX extension address
    function setDexExtension(address _dexExtension) external onlyOwner {
        dexExtension = _dexExtension;
    }
    
    /// @notice Approve DEX extension to spend tokens
    function approveDexForTokens(address[] calldata tokens) external onlyOwner {
        require(dexExtension != address(0), "DEX extension not set");
        
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] != address(0)) { // Skip native ETH
                IERC20(tokens[i]).approve(dexExtension, type(uint256).max);
            }
        }
    }
    
    /// @notice Emergency function to receive ETH
    receive() external payable {}
    
    /// @notice Emergency function to receive any tokens
    fallback() external payable {}
}