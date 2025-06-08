using InnocenceAPI.Models;
using InnocenceAPI.Services;
using Microsoft.AspNetCore.Mvc;

namespace InnocenceAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TokenController : ControllerBase
    {
        private readonly ITokenService _tokenService;
        private readonly ILogger<TokenController> _logger;

        public TokenController(ITokenService tokenService, ILogger<TokenController> logger)
        {
            _tokenService = tokenService;
            _logger = logger;
        }

        /// <summary>
        /// Get all supported tokens for the current network
        /// </summary>
        [HttpGet("supported")]
        public async Task<ActionResult<List<TokenInfoResponse>>> GetSupportedTokens()
        {
            try
            {
                var tokens = await _tokenService.GetSupportedTokensAsync();
                var network = _tokenService.GetCurrentNetwork();
                
                _logger.LogInformation("Returning {Count} tokens for network {Network}", tokens.Count, network);
                
                return Ok(new
                {
                    network = network,
                    tokens = tokens
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting supported tokens");
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get token information by symbol
        /// </summary>
        [HttpGet("symbol/{symbol}")]
        public async Task<ActionResult<TokenInfoResponse>> GetTokenBySymbol(string symbol)
        {
            try
            {
                var token = await _tokenService.GetTokenBySymbolAsync(symbol);
                if (token == null)
                {
                    return NotFound($"Token {symbol} not found on {_tokenService.GetCurrentNetwork()} network");
                }

                return Ok(token);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting token by symbol {Symbol}", symbol);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get token information by token ID
        /// </summary>
        [HttpGet("id/{tokenId:int}")]
        public async Task<ActionResult<TokenInfoResponse>> GetTokenById(int tokenId)
        {
            try
            {
                var token = await _tokenService.GetTokenByIdAsync(tokenId);
                if (token == null)
                {
                    return NotFound($"Token ID {tokenId} not found on {_tokenService.GetCurrentNetwork()} network");
                }

                return Ok(token);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting token by ID {TokenId}", tokenId);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get current network information
        /// </summary>
        [HttpGet("network")]
        public ActionResult GetNetworkInfo()
        {
            try
            {
                var network = _tokenService.GetCurrentNetwork();
                return Ok(new
                {
                    network = network,
                    isTestnet = network.Equals("testnet", StringComparison.OrdinalIgnoreCase)
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting network info");
                return StatusCode(500, "Internal server error");
            }
        }
    }
}