// FILE: FundApproval.Api/Controllers/FinalReceiverController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FundApproval.Api.Data;
using System.Security.Claims;

namespace FundApproval.Api.Controllers
{
    [ApiController]
    [Route("api/final-receiver")]
    public class FinalReceiverController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ILogger<FinalReceiverController> _logger;

        public FinalReceiverController(AppDbContext db, ILogger<FinalReceiverController> logger)
        {
            _db = db;
            _logger = logger;
        }

        private bool TryGetUserId(out int userId)
        {
            userId = 0;
            var raw =
                User.FindFirstValue("UserId") ??
                User.FindFirstValue(ClaimTypes.NameIdentifier) ??
                User.FindFirstValue("uid") ??
                User.FindFirstValue("sub");
            return int.TryParse(raw, out userId);
        }

        // Returns only APPROVED requests where the caller is a final receiver for the workflow
        // GET /api/final-receiver/requests?from=YYYY-MM-DD&to=YYYY-MM-DD
        [Authorize]
        [HttpGet("requests")]
        public async Task<IActionResult> GetMyApprovedRequests(
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            CancellationToken ct = default)
        {
            if (!TryGetUserId(out var myId))
                return Unauthorized("Missing or invalid user id claim.");

            var q = _db.FundRequests
                .AsNoTracking()
                .Include(r => r.Workflow)
                    .ThenInclude(w => w.FinalReceivers)
                .Include(r => r.Department)
                .Where(r =>
                    r.Status == "Approved" &&
                    r.Workflow.FinalReceivers.Any(fr => fr.UserId == myId)
                );

            if (from.HasValue) q = q.Where(r => r.CreatedAt >= from.Value);
            if (to.HasValue)   q = q.Where(r => r.CreatedAt <= to.Value);

            var rows = await q
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new MyFinalReceiverRequestRow
                {
                    FundRequestId = r.Id,
                    RequestTitle  = r.RequestTitle,
                    Amount        = (r.Amount ?? 0m),
                    Status        = r.Status,
                    CreatedAt     = r.CreatedAt,
                    WorkflowId    = r.WorkflowId,
                    WorkflowName  = r.Workflow.Name,
                    Department    = r.Department != null ? r.Department.Name : null
                })
                .ToListAsync(ct);

            return Ok(rows);
        }

        // Returns full trail only if the request is Approved AND the caller is a final receiver for its workflow
        // GET /api/final-receiver/requests/{requestId}/trail
        [Authorize]
        [HttpGet("requests/{requestId:int}/trail")]
        public async Task<IActionResult> GetTrailForApprovedRequest(int requestId, CancellationToken ct = default)
        {
            if (!TryGetUserId(out var myId))
                return Unauthorized("Missing or invalid user id claim.");

            // Must be Approved + caller must be a Final Receiver
            var allowed = await _db.FundRequests
                .AsNoTracking()
                .Where(r => r.Id == requestId && r.Status == "Approved")
                .AnyAsync(r => r.Workflow.FinalReceivers.Any(fr => fr.UserId == myId), ct);

            if (!allowed)
                return Forbid("You are not allowed to view this request (not Approved or you are not a Final Receiver).");

            // Load request and planned steps for context
            var request = await _db.FundRequests
                .AsNoTracking()
                .Include(r => r.Workflow)
                    .ThenInclude(w => w.Steps)
                .FirstOrDefaultAsync(r => r.Id == requestId, ct);

            if (request == null) return NotFound("Request not found.");

            var steps = request.Workflow.Steps
                .OrderBy(s => s.Sequence ?? 0)
                .Select(s => new TrailStepInfo
                {
                    Sequence        = s.Sequence ?? 0,
                    StepName        = s.StepName ?? "",
                    DesignationName = s.DesignationName ?? ""
                })
                .ToList();

            // Pull audit trail entries for this FundRequest from AuditLogs
            var logs = await _db.AuditLogs
                .AsNoTracking()
                .Where(l => l.EntityId == requestId)      // match this request
                .OrderBy(l => l.CreatedAt)
                .Select(l => new TrailEntryDto
                {
                    Action      = l.Event,                 // was Action
                    Comment     = l.Comments,
                    AtUtc       = l.CreatedAt,             // was Timestamp
                    ActorUserId = l.ActorId ?? 0,          // was UserId
                    ActorName   = l.ActorName
                })
                .ToListAsync(ct);

            var dto = new ApprovalTrailDto
            {
                FundRequestId = request.Id,
                RequestTitle  = request.RequestTitle,
                Amount        = (request.Amount ?? 0m),
                RequestStatus = request.Status,
                CreatedAt     = request.CreatedAt,
                WorkflowId    = request.WorkflowId,
                WorkflowName  = request.Workflow.Name,
                Steps         = steps,
                Entries       = logs
            };

            return Ok(dto);
        }

        // --- DTOs
        private class MyFinalReceiverRequestRow
        {
            public int    FundRequestId { get; set; }
            public string? RequestTitle { get; set; }
            public decimal Amount { get; set; }
            public string Status { get; set; } = "";
            public DateTime CreatedAt { get; set; }
            public int    WorkflowId { get; set; }
            public string WorkflowName { get; set; } = "";
            public string? Department { get; set; }
        }

        private class TrailStepInfo
        {
            public int    Sequence { get; set; }
            public string StepName { get; set; } = "";
            public string DesignationName { get; set; } = "";
        }

        private class TrailEntryDto
        {
            public string Action { get; set; } = "";
            public string? Comment { get; set; }
            public DateTime AtUtc { get; set; }
            public int ActorUserId { get; set; }
            public string? ActorName { get; set; }
        }

        private class ApprovalTrailDto
        {
            public int FundRequestId { get; set; }
            public string? RequestTitle { get; set; }
            public decimal Amount { get; set; }
            public string RequestStatus { get; set; } = "";
            public DateTime CreatedAt { get; set; }
            public int WorkflowId { get; set; }
            public string WorkflowName { get; set; } = "";
            public List<TrailStepInfo> Steps { get; set; } = new();
            public List<TrailEntryDto> Entries { get; set; } = new();
        }
    }
}
