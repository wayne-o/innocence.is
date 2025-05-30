using Microsoft.AspNetCore.Mvc;
using InnocenceAPI.Services;
using InnocenceAPI.Models;
using System.Numerics;

using Microsoft.AspNetCore.Authorization;

namespace InnocenceAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [AllowAnonymous] // Allow public access to HyperCore data
    public class HyperCoreController : ControllerBase
    {
        private readonly IHyperCoreIntegrationService _hyperCoreService;
        private readonly ILogger<HyperCoreController> _logger;

        public HyperCoreController(
            IHyperCoreIntegrationService hyperCoreService,
            ILogger<HyperCoreController> logger)
        {
            _hyperCoreService = hyperCoreService;
            _logger = logger;
        }

        [HttpGet("assets")]
        public async Task<ActionResult<List<AssetInfo>>> GetAvailableAssets()
        {
            try
            {
                var assets = await _hyperCoreService.GetAvailableAssetsAsync();
                return Ok(assets);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching assets");
                return StatusCode(500, new { error = "Failed to fetch assets" });
            }
        }

        [HttpGet("assets/{assetId}")]
        public async Task<ActionResult<AssetInfo>> GetAssetInfo(string assetId)
        {
            try
            {
                if (!BigInteger.TryParse(assetId, out var assetIdBigInt))
                {
                    return BadRequest("Invalid asset ID format");
                }

                var assetInfo = await _hyperCoreService.GetAssetInfoAsync(assetIdBigInt);
                
                if (assetInfo == null)
                {
                    return NotFound(new { error = "Asset not found" });
                }

                return Ok(assetInfo);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching asset info");
                return StatusCode(500, new { error = "Failed to fetch asset info" });
            }
        }

        [HttpGet("assets/{assetId}/price")]
        public async Task<ActionResult<decimal>> GetAssetPrice(string assetId)
        {
            try
            {
                if (!BigInteger.TryParse(assetId, out var assetIdBigInt))
                {
                    return BadRequest("Invalid asset ID format");
                }

                var price = await _hyperCoreService.GetAssetPriceAsync(assetIdBigInt);
                
                return Ok(new { assetId, price });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching asset price");
                return StatusCode(500, new { error = "Failed to fetch asset price" });
            }
        }

        [HttpGet("assets/{assetId}/validate")]
        public async Task<ActionResult<bool>> ValidateAssetForPrivacy(string assetId)
        {
            try
            {
                if (!BigInteger.TryParse(assetId, out var assetIdBigInt))
                {
                    return BadRequest("Invalid asset ID format");
                }

                var isValid = await _hyperCoreService.ValidateAssetForPrivacyAsync(assetIdBigInt);
                
                return Ok(new { assetId, isValid });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating asset");
                return StatusCode(500, new { error = "Failed to validate asset" });
            }
        }
    }
}