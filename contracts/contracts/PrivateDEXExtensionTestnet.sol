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

/// @title Private DEX Extension for Testnet
/// @notice Testnet version with configurable addresses
contract PrivateDEXExtensionTestnet {
    using SafeERC20 for IERC20;
    
    // Core components
    IPrivacySystem public immutable privacySystem;
    ISwapRouter public swapRouter;
    
    // Token addresses - can be updated by owner
    address public owner;
    address public WHYPE;
    address public UBTC;
    address public UETH;
    address public USDE;
    
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
    
    event TokensConfigured(address whype, address ubtc, address ueth, address usde);
    event RouterUpdated(address newRouter);
    
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
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor(address _privacySystem) {
        privacySystem = IPrivacySystem(_privacySystem);
        owner = msg.sender;
        
        // Testnet: These will be set after deployment
        // Leave as zero addresses initially
    }
    
    /// @notice Configure token addresses for testnet
    function configureTokens(
        address _whype,
        address _ubtc, 
        address _ueth,
        address _usde
    ) external onlyOwner {
        WHYPE = _whype;
        UBTC = _ubtc;
        UETH = _ueth;
        USDE = _usde;
        
        // Update mappings
        tokenAddresses[0] = _whype;
        tokenAddresses[1] = _ubtc;
        tokenAddresses[2] = _ueth;
        tokenAddresses[3] = _usde;
        
        emit TokensConfigured(_whype, _ubtc, _ueth, _usde);
    }
    
    /// @notice Update swap router address
    function setSwapRouter(address _swapRouter) external onlyOwner {
        swapRouter = ISwapRouter(_swapRouter);
        emit RouterUpdated(_swapRouter);
    }
    
    /// @notice Initialize commitment balance after deposit (called by privacy system or owner)
    function initializeBalance(bytes32 commitment, uint64 tokenId, uint256 amount) external {
        require(msg.sender == address(privacySystem) || msg.sender == owner, "Unauthorized");
        commitmentBalances[commitment][tokenId] = amount;
    }
    
    /// @notice Execute private swap
    function privateSwap(
        bytes32 nullifier,
        bytes calldata proof,
        bytes calldata publicValues,
        uint24 fee
    ) external returns (uint256 amountOut) {
        require(address(swapRouter) != address(0), "Router not configured");
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
        
        // Handle native token if needed
        uint256 value = (tokenIn == WHYPE && swapData.tokenIn == 0) ? swapData.amountIn : 0;
        amountOut = swapRouter.exactInputSingle{value: value}(params);
        
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
    
    /// @notice Withdraw tokens with nullifier (called by privacy system)
    function withdrawFromSwap(
        bytes32 commitment,
        uint64 tokenId,
        uint256 amount,
        address recipient
    ) external {
        require(msg.sender == address(privacySystem) || msg.sender == owner, "Unauthorized");
        require(commitmentBalances[commitment][tokenId] >= amount, "Insufficient balance");
        
        commitmentBalances[commitment][tokenId] -= amount;
        
        address token = tokenAddresses[tokenId];
        if (token == WHYPE || token == address(0)) {
            // Send native ETH
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
    
    /// @notice Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
    
    // Allow receiving ETH
    receive() external payable {}
}