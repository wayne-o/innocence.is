using System.Text.Json;
using System.Text;
using System.Security.Cryptography;
using Nethereum.Util;
using Nethereum.Signer;
using Nethereum.Hex.HexConvertors.Extensions;

namespace InnocenceAPI.Services
{
    public interface IHyperliquidTransferService
    {
        Task<string> TransferSpotTokens(string fromAddress, string privateKey, string toAddress, int tokenId, string amount);
    }

    public class HyperliquidTransferService : IHyperliquidTransferService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<HyperliquidTransferService> _logger;
        private readonly IConfiguration _configuration;
        
        // Hyperliquid Exchange API endpoint
        private const string EXCHANGE_API_URL = "https://api.hyperliquid-testnet.xyz/exchange";

        public HyperliquidTransferService(
            HttpClient httpClient,
            ILogger<HyperliquidTransferService> logger,
            IConfiguration configuration)
        {
            _httpClient = httpClient;
            _logger = logger;
            _configuration = configuration;
        }

        public async Task<string> TransferSpotTokens(
            string fromAddress, 
            string privateKey, 
            string toAddress, 
            int tokenId, 
            string amount)
        {
            try
            {
                // Create the transfer action
                var action = new
                {
                    type = "spotSend",
                    destination = toAddress.ToLower(),
                    token = tokenId.ToString(),
                    amount = amount
                };

                // Create the request payload
                var nonce = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                
                // Sign the request
                var signature = SignRequest(action, nonce, privateKey);
                var request = new
                {
                    action = action,
                    nonce = nonce,
                    signature = signature
                };

                // Send the request
                var content = new StringContent(
                    JsonSerializer.Serialize(request),
                    Encoding.UTF8,
                    "application/json"
                );

                var response = await _httpClient.PostAsync(EXCHANGE_API_URL, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError($"Transfer failed: {response.StatusCode} - {responseContent}");
                    throw new Exception($"Transfer failed: {responseContent}");
                }

                _logger.LogInformation($"Transfer successful: {responseContent}");
                return responseContent;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error transferring tokens");
                throw;
            }
        }

        private object SignRequest(object action, long nonce, string privateKey)
        {
            // Create the message to sign
            var phantomAgent = new { source = "a", connectionId = "a" };
            var messageData = new
            {
                action = action,
                nonce = nonce,
                vaultAddress = (string?)null
            };

            // Construct the signing payload
            var signPayload = new
            {
                method = "POST",
                url = "/exchange",
                data = messageData
            };

            // Serialize to JSON with sorted keys
            var jsonString = JsonSerializer.Serialize(signPayload, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = false
            });

            // Create EIP-712 typed data hash
            var messageHash = CreateEIP712Hash(action, nonce);

            // Sign with private key
            var key = new EthECKey(privateKey);
            var signature = key.SignAndCalculateV(messageHash);

            return new
            {
                r = "0x" + signature.R.ToHex(),
                s = "0x" + signature.S.ToHex(),
                v = signature.V[0]
            };
        }

        private byte[] CreateEIP712Hash(object action, long nonce)
        {
            // This is a simplified version - Hyperliquid uses EIP-712 signing
            // You'll need to implement the full EIP-712 structure based on their docs
            
            var actionJson = JsonSerializer.Serialize(action);
            var message = $"{actionJson}:{nonce}";
            
            // For now, use a simple hash (in production, implement proper EIP-712)
            var messageBytes = Encoding.UTF8.GetBytes(message);
            var ethMessage = "\x19Ethereum Signed Message:\n" + messageBytes.Length + message;
            var ethMessageBytes = Encoding.UTF8.GetBytes(ethMessage);
            
            using (var sha = SHA256.Create())
            {
                return sha.ComputeHash(ethMessageBytes);
            }
        }
    }
}