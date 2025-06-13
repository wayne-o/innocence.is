// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ISP1Verifier.sol";
import "./InnocenceVerificationKeys.sol";

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IPrivacySystem {
    function commitments(bytes32) external view returns (bool);
    function nullifiers(bytes32) external view returns (bool);
    function getMerkleRoot() external view returns (bytes32);
    function sp1Verifier() external view returns (ISP1Verifier);
}

/// @title Private DEX Extension
/// @notice Adds private swap functionality to existing privacy system
contract PrivateDEXExtension {
    using SafeERC20 for IERC20;
    
    // Core components
    IPrivacySystem public immutable privacySystem;
    ISwapRouter public constant SWAP_ROUTER = ISwapRouter(0xEBd14cdF290185Cc4d0b5eC73A0e095d780e5D2f);
    
    // Token addresses
    address public constant WHYPE = 0x5555555555555555555555555555555555555555;
    address public constant UBTC = 0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463;
    address public constant UETH = 0xBe6727B535545C67d5cAa73dEa54865B92CF7907;
    address public constant USDE = 0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34;
    
    // Token ID mappings
    mapping(uint64 => address) public tokenAddresses;
    
    // Track commitment balances
    mapping(bytes32 => mapping(uint64 => uint256)) public commitmentBalances;
    
    // Track used swap nullifiers
    mapping(bytes32 => bool) public swapNullifiers;
    
    // Events
    event PrivateSwap(
        bytes32 indexed nullifier,
        bytes32 indexed commitment,
        uint64 tokenIn,
        uint64 tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    
    // Swap proof structure
    struct SwapProofPublicValues {
        bytes32 commitment;
        bytes32 nullifierHash;
        uint64 tokenIn;
        uint64 tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        bytes32 merkleRoot;
    }
    
    constructor(address _privacySystem) {
        privacySystem = IPrivacySystem(_privacySystem);
        
        // Initialize token mappings
        tokenAddresses[0] = WHYPE; // Native HYPE wrapper
        tokenAddresses[1] = UBTC;
        tokenAddresses[2] = UETH;
        tokenAddresses[3] = USDE;
    }
    
    /// @notice Initialize commitment balance after deposit
    function initializeBalance(bytes32 commitment, uint64 tokenId, uint256 amount) external {
        require(msg.sender == address(privacySystem), "Only privacy system");
        commitmentBalances[commitment][tokenId] = amount;
    }
    
    /// @notice Execute private swap
    function privateSwap(
        bytes32 nullifier,
        bytes calldata proof,
        bytes calldata publicValues,
        uint24 fee
    ) external returns (uint256 amountOut) {
        require(!swapNullifiers[nullifier], "Swap nullifier already used");
        
        // Decode public values
        SwapProofPublicValues memory swapData = abi.decode(publicValues, (SwapProofPublicValues));
        
        // Verify commitment exists in privacy system
        require(privacySystem.commitments(swapData.commitment), "Invalid commitment");
        
        // Verify merkle root
        require(swapData.merkleRoot == privacySystem.getMerkleRoot(), "Invalid merkle root");
        
        // Verify sufficient balance
        require(commitmentBalances[swapData.commitment][swapData.tokenIn] >= swapData.amountIn, "Insufficient balance");
        
        // Verify ZK proof
        ISP1Verifier verifier = privacySystem.sp1Verifier();
        verifier.verifyProof(
            InnocenceVerificationKeys.TRADE_VKEY,
            publicValues,
            proof
        );
        
        // Mark nullifier as used
        swapNullifiers[nullifier] = true;
        
        // Update balances
        commitmentBalances[swapData.commitment][swapData.tokenIn] -= swapData.amountIn;
        
        // Get token addresses
        address tokenIn = tokenAddresses[swapData.tokenIn];
        address tokenOut = tokenAddresses[swapData.tokenOut];
        require(tokenIn != address(0) && tokenOut != address(0), "Invalid token");
        
        // Approve router
        SafeERC20.forceApprove(IERC20(tokenIn), address(SWAP_ROUTER), swapData.amountIn);
        
        // Execute swap
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: swapData.amountIn,
            amountOutMinimum: swapData.minAmountOut,
            sqrtPriceLimitX96: 0
        });
        
        amountOut = SWAP_ROUTER.exactInputSingle(params);
        
        // Update output balance
        commitmentBalances[swapData.commitment][swapData.tokenOut] += amountOut;
        
        emit PrivateSwap(
            nullifier,
            swapData.commitment,
            swapData.tokenIn,
            swapData.tokenOut,
            swapData.amountIn,
            amountOut
        );
    }
    
    /// @notice Withdraw tokens with nullifier
    function withdrawFromSwap(
        bytes32 commitment,
        uint64 tokenId,
        uint256 amount,
        address recipient
    ) external {
        require(msg.sender == address(privacySystem), "Only privacy system");
        require(commitmentBalances[commitment][tokenId] >= amount, "Insufficient balance");
        
        commitmentBalances[commitment][tokenId] -= amount;
        
        address token = tokenAddresses[tokenId];
        if (token == WHYPE) {
            // Unwrap and send ETH
            payable(recipient).transfer(amount);
        } else {
            IERC20(token).safeTransfer(recipient, amount);
        }
    }
    
    /// @notice Get all balances for a commitment
    function getBalances(bytes32 commitment) external view returns (
        uint64[] memory tokenIds,
        uint256[] memory balances
    ) {
        uint64[] memory ids = new uint64[](4);
        uint256[] memory bals = new uint256[](4);
        
        for (uint64 i = 0; i < 4; i++) {
            ids[i] = i;
            bals[i] = commitmentBalances[commitment][i];
        }
        
        return (ids, bals);
    }
    
    // Allow receiving ETH
    receive() external payable {}
}