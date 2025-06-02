using System.Numerics;
using System.Text.Json;
using System.Text.Json.Serialization;
using InnocenceAPI.Models;

namespace InnocenceAPI.Services
{
    public interface IHyperCoreIntegrationService
    {
        Task<List<AssetInfo>> GetAvailableAssetsAsync();
        Task<decimal> GetAssetPriceAsync(BigInteger assetId);
        Task<bool> ValidateAssetForPrivacyAsync(BigInteger assetId);
        Task<AssetInfo?> GetAssetInfoAsync(BigInteger assetId);
    }

    public class HyperCoreIntegrationService : IHyperCoreIntegrationService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<HyperCoreIntegrationService> _logger;

        // HyperCore API endpoint is now configured via appsettings.json
        private string HyperCoreApiUrl => _configuration["HyperCore:ApiUrl"] ?? "https://api.hyperliquid.xyz/info";
        
        // Cache for asset info to reduce API calls
        private readonly Dictionary<BigInteger, AssetInfo> _assetCache = new();
        private DateTime _lastCacheUpdate = DateTime.MinValue;
        private readonly TimeSpan _cacheExpiry = TimeSpan.FromMinutes(5);

        public HyperCoreIntegrationService(
            HttpClient httpClient, 
            IConfiguration configuration,
            ILogger<HyperCoreIntegrationService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<List<AssetInfo>> GetAvailableAssetsAsync()
        {
            try
            {
                // Check if we should use mock data for development
                var useMockData = _configuration.GetValue<bool>("HyperCore:UseMockData", false);
                if (useMockData)
                {
                    return GetMockAssets();
                }

                // Check cache
                if (DateTime.UtcNow - _lastCacheUpdate < _cacheExpiry && _assetCache.Any())
                {
                    return _assetCache.Values.ToList();
                }

                // Query HyperCore API for spot meta info
                var request = new
                {
                    type = "spotMeta"
                };

                var response = await _httpClient.PostAsync(HyperCoreApiUrl, 
                    new StringContent(JsonSerializer.Serialize(request), 
                    System.Text.Encoding.UTF8, "application/json"));

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError($"Failed to fetch assets from HyperCore: {response.StatusCode}");
                    return new List<AssetInfo>();
                }

                var content = await response.Content.ReadAsStringAsync();
                var metaData = JsonSerializer.Deserialize<HyperCoreSpotMetaResponse>(content);

                if (metaData?.Tokens == null)
                {
                    return new List<AssetInfo>();
                }

                var assets = new List<AssetInfo>();
                
                // Process spot tokens - only include major assets for now
                var majorAssets = new HashSet<string> { "USDC", "UETH", "USDT", "WBTC", "HYPE" };
                
                foreach (var token in metaData.Tokens)
                {
                    // Filter to only show major assets or canonical tokens
                    if (!majorAssets.Contains(token.Name.ToUpper()) && !token.IsCanonical)
                    {
                        continue;
                    }
                    
                    var assetInfo = new AssetInfo
                    {
                        AssetIdBigInt = new BigInteger(token.Index),
                        Symbol = token.Name,
                        Name = token.FullName ?? token.Name,
                        Decimals = token.WeiDecimals + (token.EvmContract?.EvmExtraWeiDecimals ?? 0),
                        IsPerp = false, // These are all spot assets
                        MinTradeSize = 0.001m, // Default min trade size
                        SupportsPrivacy = true, // All HyperCore assets support privacy
                        CurrentPrice = 0m, // Will be populated by price API
                        LastUpdated = DateTime.UtcNow
                    };

                    assets.Add(assetInfo);
                    _assetCache[assetInfo.AssetIdBigInt] = assetInfo;
                }

                // Try to fetch current prices
                try
                {
                    var priceRequest = new { type = "allMids" };
                    var priceResponse = await _httpClient.PostAsync(HyperCoreApiUrl,
                        new StringContent(JsonSerializer.Serialize(priceRequest),
                        System.Text.Encoding.UTF8, "application/json"));

                    if (priceResponse.IsSuccessStatusCode)
                    {
                        var priceContent = await priceResponse.Content.ReadAsStringAsync();
                        var prices = JsonSerializer.Deserialize<Dictionary<string, string>>(priceContent);
                        
                        if (prices != null)
                        {
                            foreach (var asset in assets)
                            {
                                if (prices.ContainsKey(asset.Symbol))
                                {
                                    asset.CurrentPrice = decimal.Parse(prices[asset.Symbol]);
                                }
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to fetch asset prices, continuing without prices");
                }

                _lastCacheUpdate = DateTime.UtcNow;
                return assets;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching assets from HyperCore");
                return new List<AssetInfo>();
            }
        }

        public async Task<decimal> GetAssetPriceAsync(BigInteger assetId)
        {
            try
            {
                // Check if we should use mock data for development
                var useMockData = _configuration.GetValue<bool>("HyperCore:UseMockData", false);
                if (useMockData)
                {
                    var mockAsset = await GetAssetInfoAsync(assetId);
                    return mockAsset?.CurrentPrice ?? 0;
                }

                // For HyperCore, we need to get oracle prices
                var request = new
                {
                    type = "allMids"
                };

                var response = await _httpClient.PostAsync(HyperCoreApiUrl,
                    new StringContent(JsonSerializer.Serialize(request),
                    System.Text.Encoding.UTF8, "application/json"));

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError($"Failed to fetch prices from HyperCore: {response.StatusCode}");
                    return 0;
                }

                var content = await response.Content.ReadAsStringAsync();
                var prices = JsonSerializer.Deserialize<Dictionary<string, string>>(content);

                // Get asset info to find the symbol
                var assetInfo = await GetAssetInfoAsync(assetId);
                if (assetInfo == null || prices == null || !prices.ContainsKey(assetInfo.Symbol))
                {
                    return 0;
                }

                return decimal.Parse(prices[assetInfo.Symbol]);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error fetching price for asset {assetId}");
                return 0;
            }
        }

        public async Task<bool> ValidateAssetForPrivacyAsync(BigInteger assetId)
        {
            try
            {
                // Check if we should use mock data for development
                var useMockData = _configuration.GetValue<bool>("HyperCore:UseMockData", false);
                if (useMockData)
                {
                    // Ensure mock assets are loaded
                    if (!_assetCache.Any())
                    {
                        GetMockAssets();
                    }
                }

                var assetInfo = await GetAssetInfoAsync(assetId);
                if (assetInfo == null)
                {
                    _logger.LogWarning($"Asset {assetId} not found in cache");
                    return false;
                }

                // Check if asset has sufficient liquidity
                // For now, all HyperCore assets are valid for privacy
                // In production, you might want to check:
                // - 24h volume
                // - Spread
                // - Number of active market makers
                
                return assetInfo.SupportsPrivacy;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error validating asset {assetId} for privacy");
                return false;
            }
        }

        public async Task<AssetInfo?> GetAssetInfoAsync(BigInteger assetId)
        {
            // Check cache first
            if (_assetCache.ContainsKey(assetId))
            {
                return _assetCache[assetId];
            }

            // Refresh cache
            await GetAvailableAssetsAsync();

            return _assetCache.ContainsKey(assetId) ? _assetCache[assetId] : null;
        }

        private List<AssetInfo> GetMockAssets()
        {
            var mockAssets = new List<AssetInfo>
            {
                new AssetInfo
                {
                    AssetIdBigInt = new BigInteger(0),
                    Symbol = "USDC",
                    Name = "USD Coin",
                    Decimals = 8,
                    IsPerp = false,
                    MinTradeSize = 1m,
                    SupportsPrivacy = true,
                    CurrentPrice = 1m,
                    LastUpdated = DateTime.UtcNow
                },
                new AssetInfo
                {
                    AssetIdBigInt = new BigInteger(1242),
                    Symbol = "UETH",
                    Name = "Unit Ethereum",
                    Decimals = 9,
                    IsPerp = false,
                    MinTradeSize = 0.001m,
                    SupportsPrivacy = true,
                    CurrentPrice = 3000m,
                    LastUpdated = DateTime.UtcNow
                },
                new AssetInfo
                {
                    AssetIdBigInt = new BigInteger(1105),
                    Symbol = "HYPE",
                    Name = "HyperLiquid",
                    Decimals = 18, // 8 wei decimals + 10 extra EVM decimals
                    IsPerp = false,
                    MinTradeSize = 0.1m,
                    SupportsPrivacy = true,
                    CurrentPrice = 25m,
                    LastUpdated = DateTime.UtcNow
                }
            };

            // Cache the mock assets
            foreach (var asset in mockAssets)
            {
                _assetCache[asset.AssetIdBigInt] = asset;
            }
            _lastCacheUpdate = DateTime.UtcNow;

            return mockAssets;
        }

        // HyperCore API response models
        private class HyperCoreSpotMetaResponse
        {
            [JsonPropertyName("tokens")]
            public List<SpotToken> Tokens { get; set; } = new();
            
            [JsonPropertyName("universe")]
            public List<object> Universe { get; set; } = new();
        }

        private class SpotToken
        {
            [JsonPropertyName("name")]
            public string Name { get; set; } = string.Empty;
            
            [JsonPropertyName("szDecimals")]
            public int SzDecimals { get; set; }
            
            [JsonPropertyName("weiDecimals")]
            public int WeiDecimals { get; set; }
            
            [JsonPropertyName("index")]
            public int Index { get; set; }
            
            [JsonPropertyName("tokenId")]
            public string TokenId { get; set; } = string.Empty;
            
            [JsonPropertyName("isCanonical")]
            public bool IsCanonical { get; set; }
            
            [JsonPropertyName("fullName")]
            public string? FullName { get; set; }
            
            [JsonPropertyName("evmContract")]
            public EvmContractInfo? EvmContract { get; set; }
        }
        
        private class EvmContractInfo
        {
            [JsonPropertyName("address")]
            public string Address { get; set; } = string.Empty;
            
            [JsonPropertyName("evm_extra_wei_decimals")]
            public int EvmExtraWeiDecimals { get; set; }
        }
    }
}