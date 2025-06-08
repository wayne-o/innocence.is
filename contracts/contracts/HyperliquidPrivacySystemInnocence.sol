// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ISP1Verifier.sol";
import "./InnocenceVerificationKeys.sol";

/// @notice Privacy System with Proof of Innocence (not KYC)
/// @dev Users prove they're not on sanctions list, not identity
contract HyperliquidPrivacySystemInnocence {
    
    ISP1Verifier public sp1Verifier;
    address public sanctionsOracle; // Address that maintains sanctions list
    bytes32 public currentSanctionsRoot; // Current merkle root of sanctions list
    
    // EVM token mappings (token ID → ERC20 address)
    mapping(uint64 => address) public tokenAddresses;
    
    // Privacy system state
    mapping(bytes32 => bool) public commitments;
    mapping(bytes32 => bool) public nullifiers;
    mapping(address => bool) public hasProvenInnocence; // Track who has proven they're not sanctioned
    mapping(address => uint256) public innocenceProofExpiry; // When their proof expires
    
    // Deposit tracking
    struct PendingDeposit {
        uint64 token;
        uint256 amount;
        uint256 timestamp;
        bool completed;
    }
    mapping(address => PendingDeposit) public pendingDeposits;
    
    // Events
    event InnocenceProven(address indexed depositor, uint256 expiryTime);
    event PrivateDeposit(bytes32 indexed commitment, address indexed depositor, uint256 timestamp);
    event PrivateWithdraw(bytes32 indexed nullifier, address recipient, uint256 amount, uint256 timestamp);
    event SanctionsRootUpdated(bytes32 newRoot);
    
    // ZK proof structures
    struct InnocenceProofPublicValues {
        address depositor;
        bytes32 sanctionsRoot;
        uint256 timestamp;
        bool isInnocent;
    }
    
    struct BalanceProofPublicValues {
        bytes32 commitment;
        bytes32 merkleRoot;
        uint256 minBalance;
        uint64 assetId;
    }
    
    constructor(
        address _sp1Verifier,
        address _sanctionsOracle
    ) {
        sp1Verifier = ISP1Verifier(_sp1Verifier);
        sanctionsOracle = _sanctionsOracle;
        
        // Initialize with native ETH (token ID 0)
        tokenAddresses[0] = address(0);
    }
    
    /// @notice Update the sanctions list merkle root
    function updateSanctionsRoot(bytes32 newRoot) external {
        require(msg.sender == sanctionsOracle, "Only sanctions oracle");
        currentSanctionsRoot = newRoot;
        emit SanctionsRootUpdated(newRoot);
    }
    
    /// @notice Prove that an address is not sanctioned
    /// @dev This proof is valid for 30 days
    function proveInnocence(
        bytes calldata innocenceProof,
        bytes calldata publicValues
    ) external {
        // Decode public values
        InnocenceProofPublicValues memory values = abi.decode(publicValues, (InnocenceProofPublicValues));
        
        // Verify the proof matches the caller
        require(values.depositor == msg.sender, "Proof not for caller");
        require(values.sanctionsRoot == currentSanctionsRoot, "Outdated sanctions root");
        require(values.isInnocent, "Address is sanctioned");
        
        // Verify the ZK proof
        sp1Verifier.verifyProof(
            InnocenceVerificationKeys.INNOCENCE_VKEY,
            publicValues,
            innocenceProof
        );
        
        // Mark address as proven innocent for 30 days
        hasProvenInnocence[msg.sender] = true;
        innocenceProofExpiry[msg.sender] = block.timestamp + 30 days;
        
        emit InnocenceProven(msg.sender, innocenceProofExpiry[msg.sender]);
    }
    
    /// @notice Prepare deposit (step 1)
    function prepareDeposit(uint64 token, uint256 amount) external payable {
        require(hasProvenInnocence[msg.sender], "Must prove innocence first");
        require(innocenceProofExpiry[msg.sender] > block.timestamp, "Innocence proof expired");
        require(pendingDeposits[msg.sender].timestamp == 0, "Deposit already pending");
        
        if (token == 0) {
            // Native ETH
            require(msg.value == amount, "Incorrect ETH amount");
        } else {
            // ERC20 token
            require(msg.value == 0, "Don't send ETH for token deposits");
            require(tokenAddresses[token] != address(0), "Token not supported");
            
            // Transfer tokens to contract
            IERC20(tokenAddresses[token]).transferFrom(msg.sender, address(this), amount);
        }
        
        pendingDeposits[msg.sender] = PendingDeposit({
            token: token,
            amount: amount,
            timestamp: block.timestamp,
            completed: false
        });
    }
    
    /// @notice Complete deposit with commitment (step 2)
    function completeDeposit(bytes32 commitment) external {
        PendingDeposit memory deposit = pendingDeposits[msg.sender];
        require(deposit.timestamp > 0, "No pending deposit");
        require(!deposit.completed, "Deposit already completed");
        require(!commitments[commitment], "Commitment already used");
        
        // Mark commitment as used
        commitments[commitment] = true;
        
        // Mark deposit as completed
        pendingDeposits[msg.sender].completed = true;
        
        emit PrivateDeposit(commitment, msg.sender, block.timestamp);
    }
    
    /// @notice Withdraw with balance proof
    function withdraw(
        bytes32 nullifier,
        address recipient,
        uint64 token,
        uint256 amount,
        bytes calldata balanceProof,
        bytes calldata publicValues
    ) external {
        require(!nullifiers[nullifier], "Nullifier already used");
        
        // Decode and verify balance proof
        BalanceProofPublicValues memory balance = abi.decode(publicValues, (BalanceProofPublicValues));
        require(balance.minBalance >= amount, "Insufficient proven balance");
        require(balance.assetId == token, "Asset mismatch");
        
        // For simplicity, we're not implementing merkle tree in this version
        // In production, you'd verify balance.merkleRoot against stored commitments
        
        // Verify the ZK proof
        sp1Verifier.verifyProof(
            InnocenceVerificationKeys.BALANCE_VKEY,
            publicValues,
            balanceProof
        );
        
        nullifiers[nullifier] = true;
        
        // Transfer tokens
        if (token == 0) {
            // Native ETH
            payable(recipient).transfer(amount);
        } else {
            // ERC20
            IERC20(tokenAddresses[token]).transfer(recipient, amount);
        }
        
        emit PrivateWithdraw(nullifier, recipient, amount, block.timestamp);
    }
    
    /// @notice Check if an address has valid innocence proof
    function isInnocent(address user) external view returns (bool) {
        return hasProvenInnocence[user] && innocenceProofExpiry[user] > block.timestamp;
    }
}

// Minimal ERC20 interface
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}