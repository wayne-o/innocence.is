using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using InnocenceAPI.Models;
using InnocenceAPI.Services;
using InnocenceAPI.Data;

namespace InnocenceAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ComplianceController : ControllerBase
    {
        private readonly IComplianceService _complianceService;
        private readonly ILogger<ComplianceController> _logger;

        public ComplianceController(
            IComplianceService complianceService,
            ILogger<ComplianceController> logger)
        {
            _complianceService = complianceService;
            _logger = logger;
        }

        [HttpPost("check")]
        [AllowAnonymous] // Allow anonymous access for development
        public async Task<ActionResult<ComplianceCheckResponse>> CheckCompliance(
            [FromBody] ComplianceCheckRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var response = await _complianceService.CheckComplianceAsync(request);
                
                if (response.IsCompliant)
                {
                    return Ok(response);
                }
                else
                {
                    return StatusCode(403, response); // Forbidden
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking compliance");
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        [HttpGet("certificate/{certificateId}")]
        public async Task<ActionResult<bool>> ValidateCertificate(
            string certificateId, 
            [FromQuery] string signature)
        {
            if (string.IsNullOrEmpty(certificateId) || string.IsNullOrEmpty(signature))
            {
                return BadRequest("Certificate ID and signature are required");
            }

            try
            {
                var isValid = await _complianceService.ValidateCertificateAsync(
                    certificateId, signature);
                
                return Ok(new { isValid });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating certificate");
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        [HttpPost("certificate/revoke")]
        public async Task<ActionResult> RevokeCertificate(
            [FromBody] RevokeCertificateRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var success = await _complianceService.RevokeCertificateAsync(
                    request.CertificateId, request.Reason);
                
                if (success)
                {
                    return Ok(new { message = "Certificate revoked successfully" });
                }
                else
                {
                    return NotFound(new { error = "Certificate not found" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error revoking certificate");
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        [HttpGet("sanctions")]
        public async Task<ActionResult<List<SanctionEntry>>> GetSanctionedAddresses()
        {
            try
            {
                var sanctions = await _complianceService.GetSanctionedAddressesAsync();
                return Ok(sanctions);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching sanctioned addresses");
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        [HttpGet("sanctions/check/{address}")]
        public async Task<ActionResult<bool>> CheckSanction(string address)
        {
            if (string.IsNullOrEmpty(address))
            {
                return BadRequest("Address is required");
            }

            try
            {
                var isSanctioned = await _complianceService.IsAddressSanctionedAsync(address);
                return Ok(new { address, isSanctioned });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking sanctions");
                return StatusCode(500, new { error = "Internal server error" });
            }
        }
    }

    public class RevokeCertificateRequest
    {
        public string CertificateId { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
    }
}