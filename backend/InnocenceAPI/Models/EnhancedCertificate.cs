using Nethereum.ABI.FunctionEncoding.Attributes;
using System.Numerics;

namespace InnocenceAPI.Models
{
    public class EnhancedCertificate
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Address { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public List<BigInteger> AllowedAssets { get; set; } = new();
        public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAt { get; set; }
        public string Signature { get; set; } = string.Empty;
        public bool AllowsPerps { get; set; }
        public bool AllowsYield { get; set; }
        public BigInteger MaxPositionSize { get; set; }
        public ComplianceStatus Status { get; set; } = ComplianceStatus.Active;
        public string Nonce { get; set; } = Guid.NewGuid().ToString();
    }

    public enum ComplianceStatus
    {
        Pending,
        Active,
        Expired,
        Revoked
    }

    public class ComplianceCheckRequest
    {
        public string Address { get; set; } = string.Empty;
        public decimal RequestedAmount { get; set; }
        public List<string> RequestedAssets { get; set; } = new();
        public bool RequiresPerps { get; set; }
        public string TransactionHash { get; set; } = string.Empty;
    }

    public class ComplianceCheckResponse
    {
        public bool IsCompliant { get; set; }
        public string? CertificateId { get; set; }
        public string? Signature { get; set; }
        public List<string> Reasons { get; set; } = new();
        public DateTime? ValidUntil { get; set; }
    }

    public class AssetInfo
    {
        private BigInteger _assetId;
        
        [System.Text.Json.Serialization.JsonIgnore]
        public BigInteger AssetIdBigInt 
        { 
            get => _assetId;
            set => _assetId = value;
        }
        
        [System.Text.Json.Serialization.JsonPropertyName("assetId")]
        public string AssetId 
        { 
            get => _assetId.ToString();
            set => _assetId = BigInteger.Parse(value);
        }
        
        public string Symbol { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public int Decimals { get; set; }
        public bool IsPerp { get; set; }
        public decimal MinTradeSize { get; set; }
        public bool SupportsPrivacy { get; set; }
        public decimal CurrentPrice { get; set; }
        public DateTime LastUpdated { get; set; }
    }

    public class HyperCoreAssetResponse
    {
        public string Symbol { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public int AssetId { get; set; }
        public int Decimals { get; set; }
        public decimal MinOrderSize { get; set; }
        public decimal MaxOrderSize { get; set; }
        public bool IsPerp { get; set; }
    }

    public class HyperCorePriceResponse
    {
        public decimal Price { get; set; }
        public long Timestamp { get; set; }
    }
}