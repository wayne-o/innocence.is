using System.Numerics;
using System.Text.Json;
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

        // HyperCore mainnet API endpoint
        private const string HYPERCORE_API_URL = "https://api.hyperliquid.xyz/info";
        
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

                // Query HyperCore API for meta info
                var request = new
                {
                    type = "meta"
                };

                var response = await _httpClient.PostAsync(HYPERCORE_API_URL, 
                    new StringContent(JsonSerializer.Serialize(request), 
                    System.Text.Encoding.UTF8, "application/json"));

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError($"Failed to fetch assets from HyperCore: {response.StatusCode}");
                    return new List<AssetInfo>();
                }

                var content = await response.Content.ReadAsStringAsync();
                var metaData = JsonSerializer.Deserialize<HyperCoreMetaResponse>(content);

                if (metaData?.Universe == null)
                {
                    return new List<AssetInfo>();
                }

                var assets = new List<AssetInfo>();
                
                // Process spot assets
                foreach (var spotAsset in metaData.Universe.Where(u => !u.Name.Contains("PERP")))
                {
                    var assetInfo = new AssetInfo
                    {
                        AssetIdBigInt = new BigInteger(spotAsset.Index),
                        Symbol = spotAsset.Name,
                        Name = spotAsset.Name,
                        Decimals = 8, // HyperCore uses 8 decimals
                        IsPerp = false,
                        MinTradeSize = (decimal)spotAsset.MinSize,
                        SupportsPrivacy = true // All HyperCore assets support privacy
                    };

                    assets.Add(assetInfo);
                    _assetCache[assetInfo.AssetIdBigInt] = assetInfo;
                }

                // Process perp assets
                foreach (var perpAsset in metaData.Universe.Where(u => u.Name.Contains("PERP")))
                {
                    var assetInfo = new AssetInfo
                    {
                        AssetIdBigInt = new BigInteger(perpAsset.Index),
                        Symbol = perpAsset.Name,
                        Name = perpAsset.Name,
                        Decimals = 8,
                        IsPerp = true,
                        MinTradeSize = (decimal)perpAsset.MinSize,
                        SupportsPrivacy = true
                    };

                    assets.Add(assetInfo);
                    _assetCache[assetInfo.AssetIdBigInt] = assetInfo;
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

                var response = await _httpClient.PostAsync(HYPERCORE_API_URL,
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
                    AssetIdBigInt = new BigInteger(1),
                    Symbol = "BTC",
                    Name = "Bitcoin",
                    Decimals = 8,
                    IsPerp = false,
                    MinTradeSize = 0.001m,
                    SupportsPrivacy = true,
                    CurrentPrice = 50000m,
                    LastUpdated = DateTime.UtcNow
                },
                new AssetInfo
                {
                    AssetIdBigInt = new BigInteger(2),
                    Symbol = "ETH",
                    Name = "Ethereum",
                    Decimals = 8,
                    IsPerp = false,
                    MinTradeSize = 0.01m,
                    SupportsPrivacy = true,
                    CurrentPrice = 3000m,
                    LastUpdated = DateTime.UtcNow
                },
                new AssetInfo
                {
                    AssetIdBigInt = new BigInteger(3),
                    Symbol = "SOL",
                    Name = "Solana",
                    Decimals = 8,
                    IsPerp = false,
                    MinTradeSize = 0.1m,
                    SupportsPrivacy = true,
                    CurrentPrice = 100m,
                    LastUpdated = DateTime.UtcNow
                },
                new AssetInfo
                {
                    AssetIdBigInt = new BigInteger(101),
                    Symbol = "BTC-PERP",
                    Name = "Bitcoin Perpetual",
                    Decimals = 8,
                    IsPerp = true,
                    MinTradeSize = 0.001m,
                    SupportsPrivacy = true,
                    CurrentPrice = 50000m,
                    LastUpdated = DateTime.UtcNow
                },
                new AssetInfo
                {
                    AssetIdBigInt = new BigInteger(102),
                    Symbol = "ETH-PERP",
                    Name = "Ethereum Perpetual",
                    Decimals = 8,
                    IsPerp = true,
                    MinTradeSize = 0.01m,
                    SupportsPrivacy = true,
                    CurrentPrice = 3000m,
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
        private class HyperCoreMetaResponse
        {
            public List<UniverseItem> Universe { get; set; } = new();
        }

        private class UniverseItem
        {
            public string Name { get; set; } = string.Empty;
            public int Index { get; set; }
            public double MinSize { get; set; }
            public double MaxSize { get; set; }
        }
    }
}