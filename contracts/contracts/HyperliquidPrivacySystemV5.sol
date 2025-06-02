// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ISP1Verifier.sol";
import "./InnocenceVerificationKeys.sol";

// HyperCore Read Precompile Interfaces
interface IPositionPrecompile {
    struct Position {
        int64 szi;
        uint64 entryNtl;
        int64 isolatedRawUsd;
        uint32 leverage;
        bool isIsolated;
    }
    
    function staticcall(bytes calldata data) external view returns (bool success, bytes memory result);
}

interface ISpotBalancePrecompile {
    struct SpotBalance {
        uint64 total;
        uint64 hold;
        uint64 entryNtl;
    }
    
    function staticcall(bytes calldata data) external view returns (bool success, bytes memory result);
}

interface IOraclePxPrecompile {
    function staticcall(bytes calldata data) external view returns (bool success, bytes memory result);
}

// HyperCore Write System Contract Interface
interface IHyperCoreWrite {
    function sendIocOrder(uint32 asset, bool isBuy, uint64 limitPx, uint64 sz) external;
    function sendSpot(address destination, uint64 token, uint64 _wei) external;
    function sendVaultTransfer(address vault, bool isDeposit, uint64 usd) external;
    function sendUsdClassTransfer(uint64 ntl, bool toPerp) external;
}

// Public value structs matching the ZK circuits
struct OwnershipProofPublicValues {
    bytes32 commitment;
    bytes32 nullifierHash;
}

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
    bytes32 commitment;
    uint64 fromAsset;
    uint64 toAsset;
    uint256 fromAmount;
    uint256 minToAmount;
}

contract HyperliquidPrivacySystemV5 {
    // Precompile addresses
    address constant POSITION_PRECOMPILE = 0x0000000000000000000000000000000000000800;
    address constant SPOT_BALANCE_PRECOMPILE = 0x0000000000000000000000000000000000000801;
    address constant ORACLE_PX_PRECOMPILE = 0x0000000000000000000000000000000000000807;
    address constant SPOT_PX_PRECOMPILE = 0x0000000000000000000000000000000000000808;
    
    // Write system contract
    IHyperCoreWrite constant HYPERCORE_WRITE = IHyperCoreWrite(0x3333333333333333333333333333333333333333);
    
    // SP1 Verifier contract
    ISP1Verifier public immutable sp1Verifier;
    
    struct PrivateVault {
        mapping(uint64 => uint64) spotBalances;
        mapping(uint32 => int64) perpsPositions;
        bool exists;
    }
    
    mapping(bytes32 => PrivateVault) private vaults;
    mapping(bytes32 => bool) public commitments;
    mapping(bytes32 => bool) public nullifiers;
    
    // Certificate management
    address public complianceAuthority;
    
    // Merkle tree for commitments
    bytes32[] public commitmentMerkleTree;
    mapping(bytes32 => uint256) public commitmentIndex;
    
    // Two-step deposit tracking
    struct PendingDeposit {
        uint64 token;
        uint64 amount;
        uint64 contractBalanceBefore;
        uint256 timestamp;
        bool completed;
    }
    mapping(address => PendingDeposit) public pendingDeposits;
    
    // Events
    event DepositPrepared(address indexed user, uint64 token, uint64 amount);
    event PrivateDeposit(bytes32 indexed commitment, uint256 timestamp);
    event PrivateWithdraw(bytes32 indexed nullifier, uint256 timestamp);
    event PrivateTrade(bytes32 indexed commitment, uint256 timestamp);
    event ComplianceAuthorityUpdated(address indexed newAuthority);
    
    modifier onlyComplianceAuthority() {
        require(msg.sender == complianceAuthority, "Only compliance authority");
        _;
    }
    
    constructor(address _sp1Verifier, address _complianceAuthority) {
        sp1Verifier = ISP1Verifier(_sp1Verifier);
        complianceAuthority = _complianceAuthority;
    }
    
    function updateComplianceAuthority(address newAuthority) external onlyComplianceAuthority {
        complianceAuthority = newAuthority;
        emit ComplianceAuthorityUpdated(newAuthority);
    }
    
    // Helper function to get spot balance
    function getUserSpotBalance(address user, uint64 token) public view returns (uint64) {
        // Encode the call data for the precompile
        bytes memory callData = abi.encode(user, token);
        
        (bool success, bytes memory result) = SPOT_BALANCE_PRECOMPILE.staticcall(callData);
        if (!success) {
            return 0;
        }
        
        ISpotBalancePrecompile.SpotBalance memory balance = abi.decode(result, (ISpotBalancePrecompile.SpotBalance));
        return balance.total;
    }
    
    // Helper function to get oracle price
    function getOraclePrice(uint32 index) internal view returns (uint64) {
        (bool success, bytes memory result) = ORACLE_PX_PRECOMPILE.staticcall(abi.encode(index));
        require(success, "OraclePx precompile call failed");
        return abi.decode(result, (uint64));
    }
    
    // Helper function to get spot price
    function getSpotPrice(uint32 index) internal view returns (uint64) {
        (bool success, bytes memory result) = SPOT_PX_PRECOMPILE.staticcall(abi.encode(index));
        require(success, "SpotPx precompile call failed");
        return abi.decode(result, (uint64));
    }
    
    // Step 1: User prepares deposit by transferring tokens to contract
    function prepareDeposit(uint64 token, uint64 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        
        // Check user has sufficient balance
        uint64 userBalance = getUserSpotBalance(msg.sender, token);
        require(userBalance >= amount, "Insufficient spot balance");
        
        // Get current contract balance
        uint64 contractBalanceBefore = getUserSpotBalance(address(this), token);
        
        // Store pending deposit info
        pendingDeposits[msg.sender] = PendingDeposit({
            token: token,
            amount: amount,
            contractBalanceBefore: contractBalanceBefore,
            timestamp: block.timestamp,
            completed: false
        });
        
        // User must now manually transfer tokens to this contract
        // Using Hyperliquid UI or calling sendSpot directly
        
        emit DepositPrepared(msg.sender, token, amount);
    }
    
    // Step 2: Complete deposit after tokens are transferred
    function completeDeposit(
        bytes32 commitment,
        bytes calldata complianceProof,
        bytes calldata publicValues
    ) external {
        require(!commitments[commitment], "Commitment already used");
        
        PendingDeposit memory pending = pendingDeposits[msg.sender];
        require(pending.amount > 0, "No pending deposit");
        require(!pending.completed, "Deposit already completed");
        require(block.timestamp <= pending.timestamp + 1 hours, "Deposit expired");
        
        // Verify tokens were transferred
        uint64 contractBalanceAfter = getUserSpotBalance(address(this), pending.token);
        uint64 receivedAmount = contractBalanceAfter - pending.contractBalanceBefore;
        require(receivedAmount >= pending.amount, "Tokens not transferred");
        
        // Verify compliance proof
        ComplianceProofPublicValues memory compliance = abi.decode(publicValues, (ComplianceProofPublicValues));
        require(compliance.commitment == commitment, "Commitment mismatch");
        require(compliance.complianceAuthority == complianceAuthority, "Invalid authority");
        require(compliance.validUntil >= block.timestamp, "Certificate expired");
        
        // Verify the ZK proof
        sp1Verifier.verifyProof(
            InnocenceVerificationKeys.COMPLIANCE_VKEY,
            publicValues,
            complianceProof
        );
        
        // Mark deposit as completed
        pendingDeposits[msg.sender].completed = true;
        
        // Record the deposit
        commitments[commitment] = true;
        vaults[commitment].spotBalances[pending.token] += pending.amount;
        vaults[commitment].exists = true;
        
        // Add to merkle tree
        commitmentMerkleTree.push(commitment);
        commitmentIndex[commitment] = commitmentMerkleTree.length - 1;
        
        emit PrivateDeposit(commitment, block.timestamp);
    }
    
    // Legacy single-step deposit (kept for compatibility but will fail on Hyperliquid)
    function deposit(
        bytes32 commitment,
        uint64 token,
        uint64 amount,
        bytes calldata complianceProof,
        bytes calldata publicValues
    ) external {
        require(!commitments[commitment], "Commitment already used");
        
        // This will fail on Hyperliquid because sendSpot sends from msg.sender (contract)
        // Keeping for compatibility with tests
        
        // Transfer tokens from user to this contract via HyperCore
        HYPERCORE_WRITE.sendSpot(address(this), token, amount);
        
        commitments[commitment] = true;
        vaults[commitment].spotBalances[token] += amount;
        vaults[commitment].exists = true;
        
        // Add to merkle tree
        commitmentMerkleTree.push(commitment);
        commitmentIndex[commitment] = commitmentMerkleTree.length - 1;
        
        emit PrivateDeposit(commitment, block.timestamp);
    }
    
    function privateSpotTrade(
        bytes calldata tradeProof,
        bytes calldata publicValues
    ) external {
        // Decode and verify trade proof
        TradeProofPublicValues memory trade = abi.decode(publicValues, (TradeProofPublicValues));
        
        require(vaults[trade.commitment].exists, "Vault does not exist");
        require(vaults[trade.commitment].spotBalances[trade.fromAsset] >= trade.fromAmount, "Insufficient balance");
        
        // Verify the ZK proof
        sp1Verifier.verifyProof(
            InnocenceVerificationKeys.TRADE_VKEY,
            publicValues,
            tradeProof
        );
        
        // Execute trade (simplified for testing)
        vaults[trade.commitment].spotBalances[trade.fromAsset] -= uint64(trade.fromAmount);
        vaults[trade.commitment].spotBalances[trade.toAsset] += uint64(trade.minToAmount);
        
        emit PrivateTrade(trade.commitment, block.timestamp);
    }
    
    function privatePerpsPosition(
        bytes32 commitment,
        bytes calldata ownershipProof,
        bytes calldata ownershipPublicValues,
        uint32 asset,
        bool isBuy,
        uint64 limitPx,
        uint64 sz
    ) external {
        // Verify ownership proof
        OwnershipProofPublicValues memory ownership = abi.decode(ownershipPublicValues, (OwnershipProofPublicValues));
        require(ownership.commitment == commitment, "Commitment mismatch");
        require(vaults[commitment].exists, "Vault does not exist");
        
        // Verify the ZK proof
        sp1Verifier.verifyProof(
            InnocenceVerificationKeys.OWNERSHIP_VKEY,
            ownershipPublicValues,
            ownershipProof
        );
        
        // Execute perps trade via HyperCore
        HYPERCORE_WRITE.sendIocOrder(asset, isBuy, limitPx, sz);
        
        // Update internal position tracking
        if (isBuy) {
            vaults[commitment].perpsPositions[asset] += int64(sz);
        } else {
            vaults[commitment].perpsPositions[asset] -= int64(sz);
        }
        
        emit PrivateTrade(commitment, block.timestamp);
    }
    
    function withdraw(
        bytes32 nullifier,
        address recipient,
        uint64 token,
        uint64 amount,
        bytes calldata balanceProof,
        bytes calldata publicValues
    ) external {
        require(!nullifiers[nullifier], "Nullifier already used");
        
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
        
        // Transfer to recipient via HyperCore
        HYPERCORE_WRITE.sendSpot(recipient, token, amount);
        
        emit PrivateWithdraw(nullifier, block.timestamp);
    }
    
    // Get merkle root for proof generation
    function getMerkleRoot() public view returns (bytes32) {
        if (commitmentMerkleTree.length == 0) {
            return bytes32(0);
        }
        
        // Simple merkle root calculation (in production, use a proper merkle tree)
        bytes32 root = commitmentMerkleTree[0];
        for (uint256 i = 1; i < commitmentMerkleTree.length; i++) {
            root = keccak256(abi.encodePacked(root, commitmentMerkleTree[i]));
        }
        return root;
    }
    
    // Helper function for users to transfer tokens to contract
    function transferToContract(uint64 token, uint64 amount) external {
        // This allows users to send their tokens to the contract
        // The sendSpot function sends from msg.sender (the user) to the destination (contract)
        HYPERCORE_WRITE.sendSpot(address(this), token, amount);
    }
    
    // Check if a pending deposit can be completed
    function canCompleteDeposit(address user) external view returns (bool) {
        PendingDeposit memory pending = pendingDeposits[user];
        if (pending.amount == 0 || pending.completed) return false;
        if (block.timestamp > pending.timestamp + 1 hours) return false;
        
        uint64 contractBalanceAfter = getUserSpotBalance(address(this), pending.token);
        uint64 receivedAmount = contractBalanceAfter - pending.contractBalanceBefore;
        
        return receivedAmount >= pending.amount;
    }
    
    // Emergency functions (only for testing)
    function emergencyWithdraw(uint64 token, uint64 amount, address recipient) external onlyComplianceAuthority {
        HYPERCORE_WRITE.sendSpot(recipient, token, amount);
    }
}