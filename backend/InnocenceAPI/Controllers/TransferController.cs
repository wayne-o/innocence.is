using Microsoft.AspNetCore.Mvc;
using InnocenceAPI.Services;
using System.ComponentModel.DataAnnotations;

namespace InnocenceAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TransferController : ControllerBase
    {
        private readonly ILogger<TransferController> _logger;

        public TransferController(ILogger<TransferController> logger)
        {
            _logger = logger;
        }

        public class TransferRequest
        {
            [Required]
            public string ToAddress { get; set; } = string.Empty;
            
            [Required]
            public int TokenId { get; set; }
            
            [Required]
            public string Amount { get; set; } = string.Empty;
            
            [Required]
            public string SignedMessage { get; set; } = string.Empty;
            
            [Required]
            public string UserAddress { get; set; } = string.Empty;
        }

        [HttpPost("prepare-transfer")]
        public ActionResult<object> PrepareTransfer([FromBody] TransferRequest request)
        {
            try
            {
                // Create the transfer message that the user needs to sign
                var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                var message = new
                {
                    action = "transfer",
                    from = request.UserAddress.ToLower(),
                    to = request.ToAddress.ToLower(),
                    token = request.TokenId,
                    amount = request.Amount,
                    timestamp = timestamp
                };

                return Ok(new
                {
                    message = message,
                    messageToSign = System.Text.Json.JsonSerializer.Serialize(message)
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error preparing transfer");
                return StatusCode(500, new { error = "Failed to prepare transfer" });
            }
        }
    }
}