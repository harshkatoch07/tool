using System.Linq;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FundApproval.Api.Controllers
{
    [ApiController]
    [Route("api/debug")]
    public sealed class DebugController : ControllerBase
    {
        [HttpGet("whoami")]
        [Authorize]
        public IActionResult WhoAmI()
        {
            var claims = User.Claims
                .Select(c => new { c.Type, c.Value })
                .OrderBy(c => c.Type)
                .ToList();

            string? Get(string t) => User.Claims.FirstOrDefault(c => c.Type == t)?.Value;

            return Ok(new
            {
                message = "Server sees these auth claims",
                sub = Get("sub"),
                nameidentifier = Get(ClaimTypes.NameIdentifier),
                userId = Get("UserId"),
                uid = Get("uid"),
                user_id = Get("user_id"),
                email = Get(ClaimTypes.Email) ?? Get("email"),
                all = claims
            });
        }
    }
}
