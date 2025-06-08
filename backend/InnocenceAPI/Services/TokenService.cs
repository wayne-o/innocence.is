using InnocenceAPI.Models;
using Microsoft.Extensions.Options;

namespace InnocenceAPI.Services
{
    public interface ITokenService
    {
        Task<List<TokenInfoResponse>> GetSupportedTokensAsync();
        Task<TokenInfoResponse?> GetTokenBySymbolAsync(string symbol);
        Task<TokenInfoResponse?> GetTokenByIdAsync(int tokenId);
        string GetCurrentNetwork();
    }

    public class TokenService : ITokenService
    {
        private readonly TokenConfiguration _tokenConfig;
        private readonly NetworkConfiguration _networkConfig;
        private readonly ILogger<TokenService> _logger;

        public TokenService(
            IOptions<TokenConfiguration> tokenConfig,
            IOptions<NetworkConfiguration> networkConfig,
            ILogger<TokenService> logger)
        {
            _tokenConfig = tokenConfig.Value;
            _networkConfig = networkConfig.Value;
            _logger = logger;
        }

        public Task<List<TokenInfoResponse>> GetSupportedTokensAsync()
        {
            var currentNetwork = GetCurrentNetwork();
            var supportedTokens = new List<TokenInfoResponse>();

            foreach (var token in _tokenConfig.SupportedTokens)
            {
                if (token.Networks.TryGetValue(currentNetwork, out var networkInfo))
                {
                    supportedTokens.Add(new TokenInfoResponse
                    {
                        Symbol = token.Symbol,
                        Name = token.Name,
                        Decimals = token.Decimals,
                        IsNative = token.IsNative,
                        Address = networkInfo.Address,
                        TokenId = networkInfo.TokenId,
                        Network = currentNetwork
                    });
                }
            }

            _logger.LogInformation("Returning {Count} supported tokens for network {Network}", 
                supportedTokens.Count, currentNetwork);

            return Task.FromResult(supportedTokens);
        }

        public async Task<TokenInfoResponse?> GetTokenBySymbolAsync(string symbol)
        {
            var tokens = await GetSupportedTokensAsync();
            return tokens.FirstOrDefault(t => 
                t.Symbol.Equals(symbol, StringComparison.OrdinalIgnoreCase));
        }

        public async Task<TokenInfoResponse?> GetTokenByIdAsync(int tokenId)
        {
            var tokens = await GetSupportedTokensAsync();
            return tokens.FirstOrDefault(t => t.TokenId == tokenId);
        }

        public string GetCurrentNetwork()
        {
            return _networkConfig.Environment.ToLowerInvariant();
        }
    }
}