// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ISP1Verifier.sol";
import "./InnocenceVerificationKeys.sol";

/// @notice Pure EVM Privacy System with Emergency Recovery
/// @dev Adds emergency withdrawal function for compliance authority
contract HyperliquidPrivacySystemEVMWithRecovery {
    
    ISP1Verifier public sp1Verifier;
    address public complianceAuthority;
    
    // EVM token mappings (token ID → ERC20 address)
    mapping(uint64 => address) public tokenAddresses;
    
    // Privacy system state
    mapping(bytes32 => bool) public commitments;
    mapping(bytes32 => bool) public nullifiers;
    bytes32[] public commitmentMerkleTree;
    
    // Deposit tracking
    struct PendingDeposit {
        uint64 token;
        uint256 amount;
        uint256 contractBalanceBefore;
        uint256 timestamp;
        bool completed;
    }
    mapping(address => PendingDeposit) public pendingDeposits;
    
    // Events
    event PrivateDeposit(bytes32 indexed commitment, uint256 timestamp);
    event PrivateWithdraw(bytes32 indexed nullifier, uint256 timestamp);
    event EmergencyWithdraw(address indexed recipient, uint256 amount, string reason);
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
    
    constructor(
        address _sp1Verifier,
        address _complianceAuthority
    ) {
        sp1Verifier = ISP1Verifier(_sp1Verifier);
        complianceAuthority = _complianceAuthority;
        
        // Initialize with native ETH (token ID 0)
        tokenAddresses[0] = address(0); // Native ETH
    }
    
    /// @notice Emergency withdrawal function - only compliance authority
    function emergencyWithdraw(
        address recipient,
        uint64 token,
        uint256 amount,
        string calldata reason
    ) external {
        require(msg.sender == complianceAuthority, "Only compliance authority");
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");
        
        // Transfer tokens
        _transferTokens(token, recipient, amount);
        
        emit EmergencyWithdraw(recipient, amount, reason);
    }
    
    /// @notice Emergency withdraw all ETH - only compliance authority
    function emergencyWithdrawAll(address recipient, string calldata reason) external {
        require(msg.sender == complianceAuthority, "Only compliance authority");
        require(recipient != address(0), "Invalid recipient");
        
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        
        payable(recipient).transfer(balance);
        
        emit EmergencyWithdraw(recipient, balance, reason);
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
    ) external {
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
        uint256 amount,
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
    
    /// @notice Get contract's token balance
    function _getTokenBalance(uint64 token) internal view returns (uint256) {
        if (token == 0) {
            return address(this).balance; // Native ETH
        } else {
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
    }
    
    /// @notice Transfer tokens to recipient
    function _transferTokens(uint64 token, address recipient, uint256 amount) internal {
        if (token == 0) {
            // Native ETH transfer
            require(address(this).balance >= amount, "Insufficient ETH balance");
            payable(recipient).transfer(amount);
        } else {
            // ERC20 transfer
            address tokenAddress = tokenAddresses[token];
            require(tokenAddress != address(0), "Token not supported");
            
            (bool success, ) = tokenAddress.call(
                abi.encodeWithSignature("transfer(address,uint256)", recipient, amount)
            );
            require(success, "Token transfer failed");
        }
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
    
    /// @notice Emergency function to receive ETH
    receive() external payable {}
    
    /// @notice Emergency function to receive any tokens
    fallback() external payable {}
}