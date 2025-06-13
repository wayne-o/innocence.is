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

/// @title Simple Private DEX Extension - No Initialization Required
/// @notice Uses ZK proofs to verify balances without tracking them
contract PrivateDEXExtensionSimple {
    using SafeERC20 for IERC20;
    
    // Core components
    IPrivacySystem public immutable privacySystem;
    ISwapRouter public swapRouter;
    
    // Token addresses
    address public owner;
    mapping(uint64 => address) public tokenAddresses;
    
    // Track used swap nullifiers
    mapping(bytes32 => bool) public swapNullifiers;
    
    // Track total swapped amounts per commitment (for withdrawal limits)
    mapping(bytes32 => mapping(uint64 => uint256)) public totalSwapped;
    
    // Events
    event PrivateSwap(
        bytes32 indexed nullifier,
        bytes32 indexed commitment,
        uint64 tokenIn,
        uint64 tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    
    // Swap proof structure includes balance proof
    struct SwapProofPublicValues {
        bytes32 commitment;
        bytes32 nullifierHash;
        uint64 tokenIn;
        uint64 tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 depositedAmount; // This proves how much was deposited
        bytes32 merkleRoot;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor(address _privacySystem) {
        privacySystem = IPrivacySystem(_privacySystem);
        owner = msg.sender;
    }
    
    /// @notice Configure token addresses
    function configureTokens(
        address _whype,
        address _ubtc, 
        address _ueth,
        address _usde
    ) external onlyOwner {
        tokenAddresses[0] = _whype; // HYPE/WHYPE
        tokenAddresses[1] = _ubtc;  // UBTC  
        tokenAddresses[2] = _ueth;  // WETH
        tokenAddresses[3] = _usde;  // USDE
    }
    
    /// @notice Set swap router
    function setSwapRouter(address _swapRouter) external onlyOwner {
        swapRouter = ISwapRouter(_swapRouter);
    }
    
    /// @notice Execute private swap - no initialization needed!
    /// @dev The ZK proof includes proof of deposit amount
    function privateSwap(
        bytes32 nullifier,
        bytes calldata proof,
        bytes calldata publicValues,
        uint24 fee
    ) external returns (uint256 amountOut) {
        require(address(swapRouter) != address(0), "Router not configured");
        require(!swapNullifiers[nullifier], "Swap nullifier already used");
        
        // Decode public values (includes deposit proof)
        SwapProofPublicValues memory swapData = abi.decode(publicValues, (SwapProofPublicValues));
        
        // Verify commitment exists
        require(privacySystem.commitments(swapData.commitment), "Invalid commitment");
        
        // Verify merkle root
        require(swapData.merkleRoot == privacySystem.getMerkleRoot(), "Invalid merkle root");
        
        // Check that total swapped + current swap doesn't exceed deposited amount
        uint256 previouslySwapped = totalSwapped[swapData.commitment][swapData.tokenIn];
        require(previouslySwapped + swapData.amountIn <= swapData.depositedAmount, "Exceeds deposited amount");
        
        // Verify ZK proof (this proves both the swap validity AND the deposit amount)
        ISP1Verifier verifier = privacySystem.sp1Verifier();
        verifier.verifyProof(
            InnocenceVerificationKeys.TRADE_VKEY,
            publicValues,
            proof
        );
        
        // Mark nullifier as used
        swapNullifiers[nullifier] = true;
        
        // Update total swapped
        totalSwapped[swapData.commitment][swapData.tokenIn] += swapData.amountIn;
        
        // Get token addresses
        address tokenIn = tokenAddresses[swapData.tokenIn];
        address tokenOut = tokenAddresses[swapData.tokenOut];
        require(tokenIn != address(0) && tokenOut != address(0), "Invalid token");
        
        // Transfer tokens from privacy system to this contract
        // The privacy system needs to approve this contract
        IERC20(tokenIn).safeTransferFrom(address(privacySystem), address(this), swapData.amountIn);
        
        // Approve router
        SafeERC20.forceApprove(IERC20(tokenIn), address(swapRouter), swapData.amountIn);
        
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
        
        // Native ETH handling - skip for now as it requires WETH interface
        uint256 value = 0;
        
        amountOut = swapRouter.exactInputSingle{value: value}(params);
        
        // Send output tokens back to privacy system
        // The privacy system will track the balance update
        IERC20(tokenOut).safeTransfer(address(privacySystem), amountOut);
        
        // Emit event
        emit PrivateSwap(
            nullifier,
            swapData.commitment,
            swapData.tokenIn,
            swapData.tokenOut,
            swapData.amountIn,
            amountOut
        );
    }
    
    // No initialization functions needed!
    // No balance tracking needed!
    // Everything is verified through ZK proofs!
}