using System.Security.Claims;
using FundApproval.Api.Data;
using FundApproval.Api.DTOs;
using FundApproval.Api.Models;
using FundApproval.Api.Services.Approvals;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Data.SqlClient;

namespace FundApproval.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ApprovalsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ILogger<ApprovalsController> _logger;
        private readonly IFinalReceiverProvider _finalReceivers;

        // Allowed DB statuses (must match CHECK constraint)
        private const string StatusPending   = "Pending";
        private const string StatusApproved  = "Approved";
        private const string StatusRejected  = "Rejected";
        private const string StatusSentBack  = "SentBack";
        // NOTE: DB has 'FinalReceiver' (not 'Provided'). UI can map it to "Provided".
        private const string StatusFinalReceiver = "FinalReceiver";

        public ApprovalsController(
            AppDbContext db,
            ILogger<ApprovalsController> logger,
            IFinalReceiverProvider finalReceivers)
        {
            _db = db;
            _logger = logger;
            _finalReceivers = finalReceivers;
        }

        private int GetUserIdOrThrow()
        {
            var claim = User.FindFirstValue("UserId") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(claim, out var userId))
                throw new InvalidOperationException("Authenticated user id is missing.");
            return userId;
        }

        // =====================================================================
        // ACTION on an approval (Approve / Reject / SendBack)
        // =====================================================================
        [Authorize]
        [HttpPost("{approvalId}/action")]
        public async Task<IActionResult> ActOnApproval(int approvalId, [FromBody] ApprovalActionDto dto, CancellationToken ct)
        {
            var userId = GetUserIdOrThrow();

            var approval = await _db.Approvals
                .Include(a => a.FundRequest)
                .FirstOrDefaultAsync(a => a.Id == approvalId && a.ApproverId == userId, ct);

            if (approval == null)
                return NotFound("Approval not found for this user.");

            if (approval.Status != StatusPending)
                return BadRequest("This approval is already processed.");

            var request = approval.FundRequest;
            if (request == null)
                return NotFound("Fund request not found.");

            string mappedStatus = (dto.Action ?? "").Trim() switch
            {
                "Approve"  => StatusApproved,
                "Reject"   => StatusRejected,
                "SendBack" => StatusSentBack,
                _ => ""
            };
            if (string.IsNullOrEmpty(mappedStatus))
                return BadRequest("Invalid action. Use Approve, Reject, or SendBack.");

            var now = DateTime.UtcNow;

            // close this approval
            approval.Status     = mappedStatus;
            approval.Comments   = dto.Comments;
            approval.ActionedAt = now;

            if (mappedStatus == StatusApproved)
            {
                // Load workflow & steps to find next step
                var workflow = await _db.Workflows
                    .Include(w => w.Steps)
                    .FirstOrDefaultAsync(w => w.WorkflowId == request.WorkflowId, ct);

                if (workflow == null)
                    return StatusCode(500, "Workflow not found for this request.");

                // Next step by sequence
                var nextStep = workflow.Steps
                    .Where(s => (s.Sequence ?? 0) > approval.Level)
                    .OrderBy(s => s.Sequence)
                    .FirstOrDefault();

                if (nextStep != null)
                {
                    // normal next approver (by designation)
                    var nextApprover = await _db.Users
                        .FirstOrDefaultAsync(u => u.DesignationId == nextStep.DesignationId, ct);

                    if (nextApprover == null)
                        return StatusCode(500, $"No user found for designation ID {nextStep.DesignationId}.");

                    var nextLevel = nextStep.Sequence.GetValueOrDefault(approval.Level + 1);

                    bool nextExists = await _db.Approvals.AnyAsync(a =>
                        a.FundRequestId == request.Id &&
                        a.Level == nextLevel &&
                        a.ApproverId == nextApprover.Id &&
                        a.Status == StatusPending, ct);

                    if (!nextExists)
                    {
                        _db.Approvals.Add(new Approval
                        {
                            FundRequestId = request.Id,
                            Level         = nextLevel,
                            ApproverId    = nextApprover.Id,
                            Status        = StatusPending,
                            AssignedAt    = now
                        });
                    }

                    request.CurrentLevel = nextLevel;
                    request.Status = StatusPending; // still in-flight
                }
                else
                {
                    // ========= FINAL FAN-OUT =========
                    // End of approver chain → mark request Approved and create one row PER final receiver.
                    // ========= FINAL FAN-OUT =========
// End of approver chain → mark request Approved and create one row PER final receiver.
request.Status = StatusApproved;

// Use the provider (resolves explicit users and/or by designation, scoped to dept/project)
var finalUsers = await _finalReceivers.GetFinalReceiversAsync(
    workflowId:  request.WorkflowId,
    projectId:   request.ProjectId,
    departmentId:request.DepartmentId,
    ct);

var finalLevel = approval.Level + 1;

foreach (var user in finalUsers)
{
    var rid = user.Id;

    bool exists = await _db.Approvals.AnyAsync(a =>
        a.FundRequestId == request.Id &&
        a.Level == finalLevel &&
        a.ApproverId == rid, ct);

    if (!exists)
    {
        _db.Approvals.Add(new Approval
        {
            FundRequestId = request.Id,
            Level         = finalLevel,
            ApproverId    = rid,
            Status        = StatusFinalReceiver, // UI maps to "Provided"
            AssignedAt    = now,
            ApprovedAt    = now
        });
    }
}

request.CurrentLevel = finalLevel;

                }
            }
            else if (mappedStatus == StatusRejected)
            {
                request.Status = StatusRejected;
            }
            else if (mappedStatus == StatusSentBack)
            {
                request.Status = StatusSentBack;
                
                // Calculate previous level
                var previousLevel = approval.Level - 1;
                
                if (previousLevel <= 0)
                {
                    // If current approver is first approver (level 1), send back to initiator
                    request.CurrentLevel = 0;
                }
                else
                {
                    // Find previous approver by level
                    var workflow = await _db.Workflows
                        .Include(w => w.Steps)
                        .FirstOrDefaultAsync(w => w.WorkflowId == request.WorkflowId, ct);

                    if (workflow == null)
                        return StatusCode(500, "Workflow not found for this request.");

                    var previousStep = workflow.Steps
                        .Where(s => s.Sequence == previousLevel)
                        .FirstOrDefault();

                    if (previousStep != null)
                    {
                        var previousApprover = await _db.Users
                            .FirstOrDefaultAsync(u => u.DesignationId == previousStep.DesignationId, ct);

                        if (previousApprover != null)
                        {
                            // Create new pending approval for previous approver
                            _db.Approvals.Add(new Approval
                            {
                                FundRequestId = request.Id,
                                Level = previousLevel,
                                ApproverId = previousApprover.Id,
                                Status = StatusPending,
                                AssignedAt = now
                            });
                            
                            request.CurrentLevel = previousLevel;
                        }
                    }
                }
            }

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException ex) when (ex.InnerException is SqlException sql && (sql.Number == 2601 || sql.Number == 2627))
            {
                _logger.LogError(ex, "DB unique index hit during ActOnApproval. FR={FundRequestId} Level={Level}", request.Id, request.CurrentLevel);
                return Conflict(new
                {
                    title = "Pending approval already exists",
                    status = 409,
                    detail = "A pending approval for this request/level/approver already exists. The operation is idempotent and safe to retry.",
                    traceId = HttpContext.TraceIdentifier
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "DB update failed for approvalId={ApprovalId}", approvalId);
                return Problem(
                    title: "Database update failed",
                    detail: ex.InnerException?.Message ?? ex.Message,
                    statusCode: 500);
            }

            return Ok(new { message = $"Request {mappedStatus} successfully." });
        }

        // =====================================================================
        // GET approval by ID (for ApprovalDetailsPage)
        // =====================================================================
        [Authorize]
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetApprovalById(int id)
        {
            var userId = GetUserIdOrThrow();

            var approval = await _db.Approvals
                .Include(a => a.FundRequest).ThenInclude(fr => fr.Workflow)
                .Include(a => a.FundRequest).ThenInclude(fr => fr.Department)
                .Include(a => a.FundRequest).ThenInclude(fr => fr.Initiator)
                .FirstOrDefaultAsync(a => a.Id == id && a.ApproverId == userId);

            if (approval == null)
                return NotFound("Approval not found or you are not authorized to view it.");

            return Ok(new
            {
                // Provide both for compatibility with UI (expects 'id')
                Id = approval.Id,
                ApprovalId = approval.Id,
                approval.Status,
                approval.Comments,
                approval.ActionedAt,
                approval.Level,
                approval.FundRequestId,
                RequestTitle = approval.FundRequest.RequestTitle,
                WorkflowName = approval.FundRequest.Workflow?.Name,
                DepartmentName = approval.FundRequest.Department?.Name,
                Amount = approval.FundRequest.Amount,   // ✅ Amount included
                CreatedAt = approval.FundRequest.CreatedAt
            });
        }

        // =====================================================================
        // LIST approvals by filter (assigned, initiated, approved/final, rejected, sentback)
        // =====================================================================
        [Authorize]
        [HttpGet]
        public async Task<IActionResult> GetApprovals([FromQuery] string filter)
        {
            var userId = GetUserIdOrThrow();
            _logger.LogInformation("🔍 Logged-in User ID: {UserId}, Filter: {Filter}", userId, filter);

            if (string.IsNullOrWhiteSpace(filter))
                return BadRequest("Invalid filter. Use 'assigned', 'initiated', 'approved', 'rejected', 'sentback', or 'final'.");

            var f = filter.ToLowerInvariant();

            switch (f)
            {
                case "assigned":
                {
                    var assigned = await _db.Approvals
                        .Include(a => a.FundRequest).ThenInclude(fr => fr.Workflow)
                        .Include(a => a.FundRequest).ThenInclude(fr => fr.Department)
                        .Where(a => a.ApproverId == userId && a.Status == StatusPending)
                        .Select(a => new
                        {
                            ApprovalId   = a.Id,
                            a.Status,
                            a.Comments,
                            a.ActionedAt,
                            a.Level,
                            a.FundRequestId,
                            Title        = a.FundRequest.RequestTitle,
                            WorkflowName = a.FundRequest.Workflow != null ? a.FundRequest.Workflow.Name : null,
                            Amount       = a.FundRequest.Amount,   // ✅
                            Department   = a.FundRequest.Department != null ? a.FundRequest.Department.Name : null,
                            CreatedAt    = a.FundRequest.CreatedAt,
                            InitiatorName = a.FundRequest.Initiator != null ? a.FundRequest.Initiator.FullName : null,
                            NeededBy      = a.FundRequest.NeededBy,
                            ApprovalNeededByDate = a.FundRequest.NeededBy
                        })
                        .ToListAsync();

                    return Ok(assigned);
                }

                case "initiated":
                {
                    var initiated = await _db.FundRequests
                        .Include(fr => fr.Workflow)
                        .Include(fr => fr.Department)
                        .Where(fr => fr.InitiatorId == userId)
                        .OrderByDescending(fr => fr.CreatedAt)
                        .Select(fr => new
                        {
                            ApprovalId    = (int?)null,
                            Status        = fr.Status,
                            Comments      = (string?)null,
                            ActionedAt    = (DateTime?)null,
                            Level         = fr.CurrentLevel,
                            FundRequestId = fr.Id,
                            Title         = fr.RequestTitle,
                            WorkflowName  = fr.Workflow != null ? fr.Workflow.Name : null,
                            Amount        = fr.Amount,             // ✅
                            Department    = fr.Department != null ? fr.Department.Name : null,
                            CreatedAt     = fr.CreatedAt
                        })
                        .ToListAsync();

                    return Ok(initiated);
                }

                case "final":
                case "approved":
                {
                    var finals = await _db.Approvals
                        .Include(a => a.FundRequest).ThenInclude(fr => fr.Workflow)
                        .Include(a => a.FundRequest).ThenInclude(fr => fr.Department)
                        .Where(a => a.ApproverId == userId
                                    && a.Status == StatusApproved)
                        .Select(a => new
                        {
                            ApprovalId   = a.Id,
                            a.Status,
                            a.Comments,
                            a.ActionedAt,
                            a.Level,
                            a.FundRequestId,
                            Title        = a.FundRequest.RequestTitle,
                            WorkflowName = a.FundRequest.Workflow != null ? a.FundRequest.Workflow.Name : null,
                            Amount       = a.FundRequest.Amount,   // ✅
                            Department   = a.FundRequest.Department != null ? a.FundRequest.Department.Name : null,
                            CreatedAt    = a.FundRequest.CreatedAt
                        })
                        .ToListAsync();

                    return Ok(finals);
                }

                case "rejected":
                {
                    var rejected = await _db.FundRequests
                        .Include(fr => fr.Workflow)
                        .Include(fr => fr.Department)
                        .Where(fr => fr.InitiatorId == userId && fr.Status == StatusRejected)
                        .OrderByDescending(fr => fr.CreatedAt)
                        .Select(fr => new
                        {
                            ApprovalId    = (int?)null,
                            Status        = fr.Status,
                            Comments      = (string?)null,
                            ActionedAt    = (DateTime?)null,
                            Level         = fr.CurrentLevel,
                            FundRequestId = fr.Id,
                            Title         = fr.RequestTitle,
                            WorkflowName  = fr.Workflow != null ? fr.Workflow.Name : null,
                            Amount        = fr.Amount,             // ✅
                            Department    = fr.Department != null ? fr.Department.Name : null,
                            CreatedAt     = fr.CreatedAt
                        })
                        .ToListAsync();

                    return Ok(rejected);
                }

                case "sentback":
{
    var userId = GetUserIdOrThrow();

    // A) Sent back to me (or initiator at level 0)
    var sentBackToMe = _db.Approvals
        .AsNoTracking()
        .Include(a => a.FundRequest).ThenInclude(fr => fr.Workflow)
        .Include(a => a.FundRequest).ThenInclude(fr => fr.Department)
        .Where(a =>
            // pending for me while request is in SentBack
            (a.ApproverId == userId &&
             a.Status == StatusPending &&
             a.FundRequest.Status == StatusSentBack)
            ||
            // initiator case: level 0, request is SentBack
            (a.FundRequest.InitiatorId == userId &&
             a.FundRequest.Status == StatusSentBack &&
             a.FundRequest.CurrentLevel == 0)
        )
        .Select(a => new
        {
            FundRequestId = a.FundRequest.Id,
            ApprovalId    = a.ApproverId == userId ? (int?)a.Id : null,
            Title         = a.FundRequest.RequestTitle,
            WorkflowName  = a.FundRequest.Workflow != null ? a.FundRequest.Workflow.Name : null,
            Amount        = a.FundRequest.Amount,
            Department    = a.FundRequest.Department != null ? a.FundRequest.Department.Name : null,
            Level         = a.FundRequest.CurrentLevel,
            CreatedAt     = a.FundRequest.CreatedAt,
            LastDate      = (DateTime?)a.ActionedAt ?? a.FundRequest.CreatedAt,
            IsPendingForMe = a.ApproverId == userId
        });

    // B) I sent it back (my latest action on that request = SentBack)
    var iSentBack =
        from a in _db.Approvals.AsNoTracking()
        where a.ApproverId == userId && a.ActionedAt != null
        group a by a.FundRequestId into g
        let last = g.OrderByDescending(x => x.ActionedAt).ThenByDescending(x => x.Id).FirstOrDefault()
        where last != null && last.Status == StatusSentBack
        join fr in _db.FundRequests.AsNoTracking() on g.Key equals fr.Id
        join wf in _db.Workflows.AsNoTracking() on fr.WorkflowId equals wf.WorkflowId into wf0
        from wf in wf0.DefaultIfEmpty()
        join d in _db.Departments.AsNoTracking() on fr.DepartmentId equals d.DepartmentID into d0
        from d in d0.DefaultIfEmpty()
        select new
        {
            FundRequestId = fr.Id,
            ApprovalId    = (int?)null, // not currently assigned to me
            Title         = fr.RequestTitle,
            WorkflowName  = wf != null ? wf.Name : null,
            Amount        = fr.Amount,
            Department    = d != null ? d.Name : null,
            Level         = fr.CurrentLevel,
            CreatedAt     = fr.CreatedAt,
            LastDate      = last.ActionedAt,
            IsPendingForMe = false
        };

    var items = await sentBackToMe
        .Union(iSentBack)
        .GroupBy(x => x.FundRequestId)
        .Select(g => g.OrderByDescending(x => x.LastDate).First())
        .OrderByDescending(x => x.LastDate)
        .ToListAsync();

    return Ok(items);
}

                default:
                    return BadRequest("Invalid filter. Use 'assigned', 'initiated', 'approved', 'rejected', 'sentback', or 'final'.");
            }
        }

        // =====================================================================
        // FULL APPROVAL TRAIL for a FundRequest (always shows the full path)
        // =====================================================================

        public class ApprovalTrailStepDto
        {
            public int Sequence { get; set; }
            public string StepName { get; set; } = "";
            public string? DesignationName { get; set; }
            public int? DesignationId { get; set; }

            // Approved/Rejected/Pending/SentBack/FinalReceiver/Upcoming/Created/Skipped
            public string Status { get; set; } = "Upcoming";

            public bool IsCurrent { get; set; }
            public int? ApproverUserId { get; set; }
            public string? ApproverName { get; set; }
            public DateTime? AssignedAt { get; set; }
            public DateTime? ActionedAt { get; set; }
            public string? Comments { get; set; }

            public int SLAHours { get; set; }
            public DateTime? DueAt { get; set; }
            public bool? IsOverdue { get; set; }
        }

        public class ApprovalTrailDto
        {
            public int FundRequestId { get; set; }
            public string Title { get; set; } = "";
            public int WorkflowId { get; set; }
            public string? RequestStatus { get; set; }
            public int CurrentLevel { get; set; }
            public DateTime CreatedAt { get; set; }
            public List<ApprovalTrailStepDto> Steps { get; set; } = new();
            public List<ApprovalTrailStepDto> FinalReceivers { get; set; } = new();
        }

        [Authorize]
        [HttpGet("{fundRequestId:int}/trail")]
        public async Task<IActionResult> GetApprovalTrail(int fundRequestId, CancellationToken ct)
        {
            var fr = await _db.FundRequests
                .Where(x => x.Id == fundRequestId)
                .Select(x => new
                {
                    x.Id,
                    x.RequestTitle,
                    x.WorkflowId,
                    x.Status,
                    x.CurrentLevel,
                    x.CreatedAt,
                    x.InitiatorId
                })
                .FirstOrDefaultAsync(ct);

            if (fr == null) return NotFound($"FundRequest {fundRequestId} not found.");

            var steps = await _db.WorkflowSteps
                .Where(ws => ws.WorkflowId == fr.WorkflowId)
                .OrderBy(ws => ws.Sequence)
                .Select(ws => new
                {
                    ws.StepId,
                    ws.WorkflowId,
                    ws.StepName,
                    ws.Sequence,
                    ws.SLAHours,
                    ws.DesignationId,
                    ws.DesignationName,
                    ws.IsFinalReceiver
                })
                .ToListAsync(ct);

            var approvals = await _db.Approvals
                .Where(a => a.FundRequestId == fr.Id)
                .OrderBy(a => a.Level)
                .ThenBy(a => a.ActionedAt)
                .Select(a => new
                {
                    a.Id,
                    a.Level,
                    a.Status,          // Approved/Rejected/Pending/SentBack/FinalReceiver
                    a.ActionedAt,
                    a.Comments,
                    a.ApproverId,
                    ApproverName = _db.Users.Where(u => u.Id == a.ApproverId).Select(u => u.FullName).FirstOrDefault()
                })
                .ToListAsync(ct);

            var latestPerLevel = approvals
                .GroupBy(a => a.Level)
                .ToDictionary(
                    g => g.Key,
                    g => g.OrderBy(a => a.ActionedAt ?? DateTime.MinValue).ThenBy(a => a.Id).Last()
                );

            var initiatorName = await _db.Users
                .Where(u => u.Id == fr.InitiatorId)
                .Select(u => u.FullName)
                .FirstOrDefaultAsync(ct);

            DateTime? GetStepAssignedAt(int sequence)
            {
                if (sequence <= 1) return fr.CreatedAt;
                var prevLevel = sequence - 1;
                if (latestPerLevel.TryGetValue(prevLevel, out var prev))
                    return prev.ActionedAt ?? fr.CreatedAt;
                return fr.CreatedAt;
            }

            var trail = new List<ApprovalTrailStepDto>();

            // Filter out all types of final receivers from workflow steps
            var nonFinalSteps = steps.Where(s => 
                !(s.IsFinalReceiver ?? false) && 
                (s.StepName?.ToLower() ?? "") != "final receiver" &&
                !((s.StepName?.ToLower() ?? "").Contains("final")));

            foreach (var s in nonFinalSteps)
            {
                var dto = new ApprovalTrailStepDto
                {
                    Sequence = s.Sequence ?? 0,
                    StepName = s.StepName,
                    DesignationId = s.DesignationId,
                    DesignationName = s.DesignationName,
                    SLAHours = s.SLAHours ?? 0,
                    IsCurrent = (fr.CurrentLevel == (s.Sequence ?? 0))
                };

                if ((s.Sequence ?? 0) == 1)
                {
                    dto.ApproverUserId = fr.InitiatorId;
                    dto.ApproverName = initiatorName ?? "Initiator";
                    dto.AssignedAt = fr.CreatedAt;
                    dto.ActionedAt = fr.CreatedAt;
                    dto.Status = "Created";
                }
                else if (latestPerLevel.TryGetValue(s.Sequence ?? 0, out var appr))
                {
                    dto.ApproverUserId = appr.ApproverId;
                    dto.ApproverName = appr.ApproverName;
                    dto.AssignedAt = GetStepAssignedAt(s.Sequence ?? 0);
                    dto.ActionedAt = appr.ActionedAt;
                    dto.Comments = appr.Comments;
                    dto.Status = string.IsNullOrWhiteSpace(appr.Status) ? StatusPending : appr.Status;
                }
                else
                {
                    dto.AssignedAt = GetStepAssignedAt(s.Sequence ?? 0);
                    dto.Status = ((s.Sequence ?? 0) < fr.CurrentLevel) ? "Skipped"
                             : ((s.Sequence ?? 0) == fr.CurrentLevel) ? StatusPending
                             : "Upcoming";
                }

                if (dto.SLAHours > 0 && dto.AssignedAt.HasValue)
                {
                    dto.DueAt = dto.AssignedAt.Value.AddHours(dto.SLAHours);
                    dto.IsOverdue = (dto.ActionedAt == null) && (DateTime.UtcNow > dto.DueAt.Value);
                }

                trail.Add(dto);
            }

            // Final receivers are excluded from the approval trail
            // Populate finalReceiverDtos from workflow steps
            var finalReceiverDtos = steps
                .Where(s => (s.IsFinalReceiver ?? false) || (s.StepName?.ToLower() ?? "").Contains("final"))
                .Select(s => new ApprovalTrailStepDto
                {
                    Sequence = s.Sequence ?? 0,
                    StepName = s.StepName,
                    DesignationId = s.DesignationId,
                    DesignationName = s.DesignationName,
                    Status = "Upcoming"
                })
                .ToList();

            var result = new ApprovalTrailDto
            {
                FundRequestId = fr.Id,
                Title = fr.RequestTitle ?? "",
                WorkflowId = fr.WorkflowId,
                RequestStatus = fr.Status,
                CurrentLevel = fr.CurrentLevel,
                CreatedAt = fr.CreatedAt,
                Steps = trail,
                FinalReceivers = finalReceiverDtos
            };

            return Ok(result);
        }

        // =====================================================================
        // FORM SNAPSHOT for ApprovalDetailsPage (includes Amount)
        // =====================================================================
        [Authorize]
        [HttpGet("{approvalId:int}/form-snapshot")]
        public async Task<IActionResult> GetFormSnapshot(int approvalId)
        {
            var userId = GetUserIdOrThrow();

            var approval = await _db.Approvals
                .Include(a => a.FundRequest).ThenInclude(fr => fr.Fields)
                .Include(a => a.FundRequest).ThenInclude(fr => fr.Department)
                .Include(a => a.FundRequest).ThenInclude(fr => fr.Workflow)
                .Include(a => a.FundRequest).ThenInclude(fr => fr.Project)
                .FirstOrDefaultAsync(a => a.Id == approvalId && a.ApproverId == userId);

            if (approval == null)
                return NotFound("Approval not found or you are not authorized to view it.");

            var fr = approval.FundRequest!;

            var fields = new List<object>
            {
                new { key = "Id",          label = "Request ID",      value = fr.Id },
                new { key = "Title",       label = "Title",           value = fr.RequestTitle },
                new { key = "Description", label = "Description",     value = fr.Description },
                new { key = "Amount",      label = "Amount",          value = fr.Amount },             // ✅ Amount
                new { key = "Workflow",    label = "Workflow",        value = fr.Workflow?.Name },
                new { key = "Department",  label = "Department",      value = fr.Department?.Name },
                new { key = "Project",     label = "Project",         value = fr.Project?.Name },
                new { key = "Status",      label = "Status",          value = fr.Status },
                new { key = "CreatedAt",   label = "Created At",      value = fr.CreatedAt }
            };

            // Append dynamic form fields
            foreach (var f in fr.Fields.OrderBy(x => x.Id))
            {
                fields.Add(new
                {
                    key = f.FieldName,
                    label = f.FieldName,
                    value = f.FieldValue
                });
            }

            return Ok(new { fields });
        }

        // =====================================================================
        // FINAL RECEIVER: full request details (dialog)
        // =====================================================================
        public record FinalReceiverRequestDto(
            int Id,
            string Title,
            string? Description,
            decimal Amount,
            string Status,
            DateTime CreatedAt,
            string InitiatorName,
            string? InitiatorEmail,
            string? DepartmentName,
            string? ProjectName,
            IEnumerable<FieldDto> Fields,
            IEnumerable<AttachmentDto> Attachments,
            IEnumerable<ApprovalTrailItemDto> Trail
        );

        public record FieldDto(string Name, string? Value);
        public record AttachmentDto(int Id, string FileName, long FileSize, string ContentType);
        public record ApprovalTrailItemDto(int Level, string ApproverName, string Status, DateTime? ActionedAt, string? Comments);

        [Authorize]
        [HttpGet("final/{fundRequestId:int}")]
        [HttpGet("/api/final-receiver/requests/{fundRequestId:int}")]
        public async Task<ActionResult<FinalReceiverRequestDto>> GetFinalReceiverRequest(int fundRequestId)
        {
            var frq = await _db.FundRequests
                .AsNoTracking()
                .Where(fr => fr.Id == fundRequestId)
                .Select(fr => new
                {
                    fr.Id,
                    Title = fr.RequestTitle,
                    fr.Description,
                    fr.Amount,                        // ✅ Amount
                    fr.Status,
                    fr.CreatedAt,
                    Initiator = _db.Users.Where(u => u.Id == fr.InitiatorId).Select(u => new { u.FullName, u.Email }).FirstOrDefault(),
                    DepartmentName = _db.Departments.Where(d => d.DepartmentID == fr.DepartmentId).Select(d => d.Name).FirstOrDefault(),
                    ProjectName = _db.Projects.Where(p => p.Id == fr.ProjectId).Select(p => p.Name).FirstOrDefault(),
                    Fields = fr.Fields.Select(f => new FieldDto(f.FieldName, f.FieldValue)),
                    Attachments = fr.Attachments.Select(a => new AttachmentDto(a.Id, a.FileName, a.FileSize, a.ContentType)),
                    Trail = fr.Approvals
                        .OrderBy(a => a.Level)
                        .Select(a => new ApprovalTrailItemDto(
                            a.Level,
                            _db.Users.Where(u => u.Id == a.ApproverId).Select(u => u.FullName).FirstOrDefault() ?? ("User#" + a.ApproverId),
                            a.Status,
                            a.ActionedAt,
                            a.Comments
                        ))
                })
                .FirstOrDefaultAsync();

            if (frq == null) return NotFound();

            var dto = new FinalReceiverRequestDto(
                frq.Id,
                frq.Title ?? "Request",
                frq.Description,
                frq.Amount?? 0m,                 // ✅ Amount
                frq.Status,
                frq.CreatedAt,
                frq.Initiator?.FullName ?? "Unknown",
                frq.Initiator?.Email,
                frq.DepartmentName,
                frq.ProjectName,
                frq.Fields.ToList(),
                frq.Attachments.ToList(),
                frq.Trail.ToList()
            );

            return Ok(dto);
        }
    }
}
