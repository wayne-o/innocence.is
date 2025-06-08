namespace InnocenceAPI.Models
{
    public class TokenConfiguration
    {
        public List<SupportedToken> SupportedTokens { get; set; } = new();
    }

    public class SupportedToken
    {
        public string Symbol { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public int Decimals { get; set; }
        public bool IsNative { get; set; }
        public Dictionary<string, NetworkTokenInfo> Networks { get; set; } = new();
    }

    public class NetworkTokenInfo
    {
        public string Address { get; set; } = string.Empty;
        public int TokenId { get; set; }
    }

    public class NetworkConfiguration
    {
        public string Environment { get; set; } = string.Empty;
        public string RpcUrl { get; set; } = string.Empty;
        public int ChainId { get; set; }
    }

    public class TokenInfoResponse
    {
        public string Symbol { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public int Decimals { get; set; }
        public bool IsNative { get; set; }
        public string Address { get; set; } = string.Empty;
        public int TokenId { get; set; }
        public string Network { get; set; } = string.Empty;
    }
}