using System.Numerics;
using System.Security.Cryptography;
using System.Text;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using InnocenceAPI.Data;
using InnocenceAPI.Models;
using Nethereum.Util;
using Nethereum.Signer;
using Nethereum.Hex.HexConvertors.Extensions;

namespace InnocenceAPI.Services
{
    public interface IComplianceService
    {
        Task<ComplianceCheckResponse> CheckComplianceAsync(ComplianceCheckRequest request);
        Task<EnhancedCertificate?> IssueCertificateAsync(string address, decimal amount, List<BigInteger> allowedAssets);
        Task<bool> ValidateCertificateAsync(string certificateId, string signature);
        Task<bool> RevokeCertificateAsync(string certificateId, string reason);
        Task<List<SanctionEntry>> GetSanctionedAddressesAsync();
        Task<bool> IsAddressSanctionedAsync(string address);
    }

    public class ComplianceService : IComplianceService
    {
        private readonly ComplianceContext _context;
        private readonly IConfiguration _configuration;
        private readonly ILogger<ComplianceService> _logger;
        private readonly IHyperCoreIntegrationService _hyperCoreService;
        private readonly string _signingKey;
        private readonly EthereumMessageSigner _messageSigner;

        public ComplianceService(
            ComplianceContext context,
            IConfiguration configuration,
            ILogger<ComplianceService> logger,
            IHyperCoreIntegrationService hyperCoreService)
        {
            _context = context;
            _configuration = configuration;
            _logger = logger;
            _hyperCoreService = hyperCoreService;
            _signingKey = configuration["Compliance:SigningKey"] ?? GenerateSigningKey();
            _messageSigner = new EthereumMessageSigner();
        }

        public async Task<ComplianceCheckResponse> CheckComplianceAsync(ComplianceCheckRequest request)
        {
            var response = new ComplianceCheckResponse();

            try
            {
                // Log the compliance check
                var log = new ComplianceLog
                {
                    Address = request.Address,
                    Action = "ComplianceCheck",
                    Result = false,
                    Details = $"Amount: {request.RequestedAmount}, Assets: {string.Join(",", request.RequestedAssets)}"
                };

                // 1. Check if address is sanctioned
                if (await IsAddressSanctionedAsync(request.Address))
                {
                    response.IsCompliant = false;
                    response.Reasons.Add("Address is on sanctions list");
                    log.Result = false;
                    _context.ComplianceLogs.Add(log);
                    await _context.SaveChangesAsync();
                    return response;
                }

                // 2. Validate requested assets
                foreach (var assetIdString in request.RequestedAssets)
                {
                    var assetId = BigInteger.Parse(assetIdString);
                    if (!await _hyperCoreService.ValidateAssetForPrivacyAsync(assetId))
                    {
                        response.IsCompliant = false;
                        response.Reasons.Add($"Asset {assetIdString} is not supported for privacy transactions");
                        log.Result = false;
                        _context.ComplianceLogs.Add(log);
                        await _context.SaveChangesAsync();
                        return response;
                    }
                }

                // 3. Check for existing valid certificate
                var existingCert = await _context.Certificates
                    .Where(c => c.Address == request.Address 
                        && c.Status == ComplianceStatus.Active 
                        && c.ExpiresAt > DateTime.UtcNow)
                    .FirstOrDefaultAsync();

                if (existingCert != null)
                {
                    // Validate amount and assets
                    var requestedAssetsBigInt = request.RequestedAssets.Select(a => BigInteger.Parse(a)).ToList();
                    if (existingCert.Amount >= request.RequestedAmount &&
                        requestedAssetsBigInt.All(a => existingCert.AllowedAssets.Contains(a)))
                    {
                        response.IsCompliant = true;
                        response.CertificateId = existingCert.Id;
                        response.Signature = existingCert.Signature;
                        response.ValidUntil = existingCert.ExpiresAt;
                        log.Result = true;
                        log.CertificateId = existingCert.Id;
                    }
                    else
                    {
                        response.IsCompliant = false;
                        response.Reasons.Add("Certificate limits exceeded");
                    }
                }
                else
                {
                    // Issue new certificate
                    var assetsBigInt = request.RequestedAssets.Select(a => BigInteger.Parse(a)).ToList();
                    var newCert = await IssueCertificateAsync(
                        request.Address, 
                        request.RequestedAmount, 
                        assetsBigInt);

                    if (newCert != null)
                    {
                        response.IsCompliant = true;
                        response.CertificateId = newCert.Id;
                        response.Signature = newCert.Signature;
                        response.ValidUntil = newCert.ExpiresAt;
                        log.Result = true;
                        log.CertificateId = newCert.Id;
                    }
                    else
                    {
                        response.IsCompliant = false;
                        response.Reasons.Add("Failed to issue certificate");
                    }
                }

                _context.ComplianceLogs.Add(log);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during compliance check");
                response.IsCompliant = false;
                response.Reasons.Add("Internal error during compliance check");
            }

            return response;
        }

        public async Task<EnhancedCertificate?> IssueCertificateAsync(
            string address, 
            decimal amount, 
            List<BigInteger> allowedAssets)
        {
            try
            {
                _logger.LogInformation($"Issuing certificate for address: {address}, amount: {amount}, assets: {string.Join(",", allowedAssets)}");
                
                // Final sanctions check
                if (await IsAddressSanctionedAsync(address))
                {
                    _logger.LogWarning($"Address {address} is sanctioned, cannot issue certificate");
                    return null;
                }

                var certificate = new EnhancedCertificate
                {
                    Address = address,
                    Amount = amount,
                    AllowedAssets = allowedAssets,
                    IssuedAt = DateTime.UtcNow,
                    ExpiresAt = DateTime.UtcNow.AddDays(30), // 30 day validity
                    AllowsPerps = true, // Enable perps trading
                    AllowsYield = true, // Enable yield generation
                    MaxPositionSize = new BigInteger(1000000) * BigInteger.Pow(10, 8), // 1M USD equivalent
                    Status = ComplianceStatus.Active
                };

                // Generate signature
                var message = GenerateCertificateMessage(certificate);
                certificate.Signature = SignMessage(message);

                _context.Certificates.Add(certificate);
                await _context.SaveChangesAsync();

                return certificate;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error issuing certificate");
                return null;
            }
        }

        public async Task<bool> ValidateCertificateAsync(string certificateId, string signature)
        {
            try
            {
                var certificate = await _context.Certificates
                    .FirstOrDefaultAsync(c => c.Id == certificateId);

                if (certificate == null)
                {
                    return false;
                }

                // Check status and expiry
                if (certificate.Status != ComplianceStatus.Active || 
                    certificate.ExpiresAt < DateTime.UtcNow)
                {
                    return false;
                }

                // Verify signature
                var message = GenerateCertificateMessage(certificate);
                return VerifySignature(message, signature);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating certificate");
                return false;
            }
        }

        public async Task<bool> RevokeCertificateAsync(string certificateId, string reason)
        {
            try
            {
                var certificate = await _context.Certificates
                    .FirstOrDefaultAsync(c => c.Id == certificateId);

                if (certificate == null)
                {
                    return false;
                }

                certificate.Status = ComplianceStatus.Revoked;
                
                var log = new ComplianceLog
                {
                    Address = certificate.Address,
                    Action = "CertificateRevoked",
                    Result = true,
                    CertificateId = certificateId,
                    Details = reason
                };

                _context.ComplianceLogs.Add(log);
                await _context.SaveChangesAsync();

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error revoking certificate");
                return false;
            }
        }

        public async Task<List<SanctionEntry>> GetSanctionedAddressesAsync()
        {
            return await _context.SanctionEntries
                .Where(s => s.IsActive)
                .ToListAsync();
        }

        public async Task<bool> IsAddressSanctionedAsync(string address)
        {
            // Normalize address
            address = address.ToLowerInvariant();

            // Check direct match
            var isSanctioned = await _context.SanctionEntries
                .AnyAsync(s => s.Address.ToLower() == address && s.IsActive);

            if (isSanctioned)
            {
                return true;
            }

            // In production, you would also check:
            // - Connected addresses (graph analysis)
            // - Tornado Cash interactions
            // - Other risk indicators

            return false;
        }

        private string GenerateCertificateMessage(EnhancedCertificate certificate)
        {
            var assets = string.Join(",", certificate.AllowedAssets);
            return $"{certificate.Id}|{certificate.Address}|{certificate.Amount}|{assets}|{certificate.ExpiresAt:O}|{certificate.Nonce}";
        }

        private string SignMessage(string message)
        {
            try
            {
                // For development, use a simple hash-based signature
                // In production, implement proper signing
                using (var sha256 = SHA256.Create())
                {
                    var messageBytes = Encoding.UTF8.GetBytes(message);
                    var hashBytes = sha256.ComputeHash(messageBytes);
                    var signature = "0x" + BitConverter.ToString(hashBytes).Replace("-", "").ToLower();
                    
                    // Pad to make it look like a proper signature (65 bytes = 130 hex chars)
                    while (signature.Length < 132) // 0x + 130 chars
                    {
                        signature += "00";
                    }
                    
                    return signature;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error signing message");
                // Return a dummy signature for development
                return "0x" + new string('0', 130); // 65 bytes in hex
            }
        }

        private bool VerifySignature(string message, string signature)
        {
            try
            {
                // For development, recreate the hash and compare
                using (var sha256 = SHA256.Create())
                {
                    var messageBytes = Encoding.UTF8.GetBytes(message);
                    var hashBytes = sha256.ComputeHash(messageBytes);
                    var expectedSignature = "0x" + BitConverter.ToString(hashBytes).Replace("-", "").ToLower();
                    
                    // Pad to make it look like a proper signature
                    while (expectedSignature.Length < 132)
                    {
                        expectedSignature += "00";
                    }
                    
                    return signature.Equals(expectedSignature, StringComparison.InvariantCultureIgnoreCase);
                }
            }
            catch
            {
                return false;
            }
        }

        private string GenerateSigningKey()
        {
            // Generate a new private key for signing
            var key = EthECKey.GenerateKey();
            return key.GetPrivateKeyAsBytes().ToHex();
        }
    }
}