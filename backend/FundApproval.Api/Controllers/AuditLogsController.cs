using FundApproval.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Linq;

namespace FundApproval.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuditLogsController : ControllerBase
    {
        private readonly AppDbContext _db;
        public AuditLogsController(AppDbContext db) => _db = db;

        [Authorize]
        [HttpGet]
        public IActionResult GetLogs([FromQuery] int fundRequestId)
        {
            var logs = _db.AuditLogs
                .Where(l => l.EntityId == fundRequestId) // ✅ use EntityId
                .OrderByDescending(l => l.CreatedAt)     // ✅ use CreatedAt not Timestamp
                .Select(l => new
                {
                    l.Id,
                    l.Event,
                    l.Entity,
                    FundRequestId = l.EntityId, // ✅ keep same API contract
                    l.ActorId,
                    l.ActorName,
                    l.Comments,
                    Timestamp = l.CreatedAt     // ✅ map back for frontend
                })
                .ToList();

            return Ok(logs);
        }
    }
}
