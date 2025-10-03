using System;
using System.Linq;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using FundApproval.Api.Data;
using FundApproval.Api.DTOs;
using FundApproval.Api.Models;
using FundApproval.Api.Services.Approvals;
using FundApproval.Api.Services.Notifications; // interface lives here
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FundApproval.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FundRequestsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ILogger<FundRequestsController> _logger;
        private readonly IApproverResolver _approverResolver;
        private readonly INotificationOrchestrator _notificationOrchestrator; // <-- interface

        public FundRequestsController(
            AppDbContext db,
            ILogger<FundRequestsController> logger,
            IApproverResolver approverResolver,
            INotificationOrchestrator notificationOrchestrator) // <-- interface
        {
            _db = db;
            _logger = logger;
            _approverResolver = approverResolver;
            _notificationOrchestrator = notificationOrchestrator;
        }

        private int GetUserIdOrThrow()
        {
            var candidates = new[]
            {
                "UserId",
                ClaimTypes.NameIdentifier,
                "sub",
                "uid",
                "user_id"
            };

            foreach (var c in candidates)
            {
                var raw = User.FindFirstValue(c);
                if (!string.IsNullOrWhiteSpace(raw) && int.TryParse(raw, out var id))
                    return id;
            }

            var email = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
            if (!string.IsNullOrWhiteSpace(email))
            {
                var id = _db.Users
                    .Where(u => u.Email != null && u.Email == email)
                    .Select(u => u.Id)
                    .FirstOrDefault();
                if (id > 0) return id;
            }

            throw new InvalidOperationException(
                "Token missing an integer user id (UserId/NameIdentifier/sub/uid/user_id) and email did not map to a user.");
        }

        private static DateTime? ParseDate(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return null;
            return DateTime.TryParse(s, out var dt) ? dt : null;
        }

        // ------------------ CREATE ------------------
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> CreateFundRequest([FromBody] FundRequestDto dto)
        {
            _logger.LogInformation("📥 Incoming FundRequest payload: {@dto}", dto);

            if (dto == null)
                return BadRequest("Invalid request data.");

            // Normalize nullable WorkflowId (int?) to int
            var wfId = dto.WorkflowId.GetValueOrDefault(0);
            if (wfId <= 0)
                ModelState.AddModelError(nameof(dto.WorkflowId), "WorkflowId is required.");

            if (!ModelState.IsValid)
                return ValidationProblem(ModelState);

            var initiatorId = GetUserIdOrThrow();

            // Look up workflow with the normalized int wfId
            var workflow = await _db.Workflows
                .AsNoTracking()
                .FirstOrDefaultAsync(w => w.WorkflowId == wfId, HttpContext.RequestAborted);

            if (workflow == null)
                return BadRequest("Invalid WorkflowId.");

            // DepartmentId is a non-nullable int in your model
            if (workflow.DepartmentId <= 0)
                return BadRequest("Selected workflow is not linked to any Department.");

            var inferredDepartmentId = workflow.DepartmentId;

            // Project optional: validate only if > 0, and normalize to int
            var projectId = dto.ProjectId.GetValueOrDefault(0);
            if (projectId > 0)
            {
                var exists = await _db.Projects.AnyAsync(p => p.Id == projectId, HttpContext.RequestAborted);
                if (!exists) return BadRequest("Invalid ProjectId.");
            }

            var fr = new FundRequest
            {
                RequestTitle = dto.Title,
                Description  = dto.Description ?? string.Empty,
                Amount       = dto.Amount,
                InitiatorId  = initiatorId,
                Status       = "Pending",
                CreatedAt    = DateTime.UtcNow,

                WorkflowId   = wfId,
                DepartmentId = inferredDepartmentId,
                ProjectId    = projectId,

                Fields = dto.Fields?.Select(f => new FundRequestField
                {
                    FieldName  = f.FieldName,
                    FieldValue = f.FieldValue ?? string.Empty
                }).ToList() ?? new List<FundRequestField>()
            };

            // ✅ Set NeededBy from "ApprovalBy" field if provided
            var approvalByRaw = dto.Fields?
                .FirstOrDefault(f => string.Equals(f.FieldName, "ApprovalBy", StringComparison.OrdinalIgnoreCase))
                ?.FieldValue;
            fr.NeededBy = ParseDate(approvalByRaw);

            // Steps & approver
            var steps = await _db.WorkflowSteps
                .Where(ws => ws.WorkflowId == fr.WorkflowId)
                .OrderBy(ws => ws.Sequence)
                .ToListAsync(HttpContext.RequestAborted);

            var firstRealStep = steps.FirstOrDefault(s => !_approverResolver.IsInitiatorStep(s));
            if (firstRealStep == null)
                return BadRequest("No approver steps defined for this workflow.");

            (int approverId, string approverName, int stepDesignationId) resolution;
            try
            {
                resolution = await _approverResolver.ResolveAsync(
                    firstRealStep, initiatorId, fr.ProjectId, fr.DepartmentId, HttpContext.RequestAborted);
            }
            catch (InvalidOperationException ex)
            {
                return UnprocessableEntity(new ProblemDetails
                {
                    Title = "Approver resolution failed",
                    Detail = ex.Message,
                    Status = StatusCodes.Status422UnprocessableEntity
                });
            }

            // Tx + save + notify
            var strategy = _db.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await using var tx = await _db.Database.BeginTransactionAsync(HttpContext.RequestAborted);

                _db.FundRequests.Add(fr);
                _db.Approvals.Add(new Approval
                {
                    FundRequest = fr,
                    Level       = firstRealStep.Sequence.GetValueOrDefault(1),
                    ApproverId  = resolution.approverId,
                    Status      = "Pending"
                });

                fr.CurrentLevel = firstRealStep.Sequence.GetValueOrDefault(1);

                await _db.SaveChangesAsync(HttpContext.RequestAborted);

                await _notificationOrchestrator.OnInitiatedAsync(
                    fr.Id, initiatorId, resolution.approverId, HttpContext.RequestAborted);

                await _db.SaveChangesAsync(HttpContext.RequestAborted);
                await tx.CommitAsync(HttpContext.RequestAborted);
            });

            return CreatedAtAction(nameof(GetRequest), new { id = fr.Id }, new { id = fr.Id, fundRequestId = fr.Id });
        }

        // ------------------ DETAILS ------------------
        [Authorize]
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetRequest(int id)
        {
            var data = await _db.FundRequests
                .Where(f => f.Id == id)
                .Select(f => new FundRequestDetailsDto
                {
                    Id = f.Id,
                    RequestTitle = f.RequestTitle,
                    Description = f.Description,
                    Amount = f.Amount,
                    Status = f.Status,
                    CurrentLevel = f.CurrentLevel,
                    CreatedAt = f.CreatedAt,
                    WorkflowId = f.WorkflowId,
                    DepartmentId = f.DepartmentId,
                    WorkflowName = f.Workflow != null ? f.Workflow.Name : null,
                    DepartmentName = f.Department != null ? f.Department.Name : null,
                    ProjectName = f.Project != null ? f.Project.Name : null,
                    Fields = f.Fields
                        .OrderBy(x => x.Id)
                        .Select(x => new FundRequestDetailsDto.FieldDto
                        {
                            Id = x.Id,
                            FieldName = x.FieldName,
                            FieldValue = x.FieldValue
                        }).ToList(),
                    Approvals = f.Approvals
                        .OrderBy(a => a.Level)
                        .Select(a => new FundRequestDetailsDto.ApprovalDto
                        {
                            Id = a.Id,
                            Level = a.Level,
                            ApproverId = a.ApproverId,
                            ApproverName = a.Approver != null && !string.IsNullOrEmpty(a.Approver.FullName)
                                ? a.Approver.FullName
                                : ("User #" + a.ApproverId),
                            Status = a.Status,
                            Comments = a.Comments,
                            ActionedAt = a.ActionedAt
                        }).ToList()
                })
                .AsNoTracking()
                .FirstOrDefaultAsync();

            if (data == null) return NotFound();
            return Ok(data);
        }

        // ------------------ DASHBOARD ------------------
        [Authorize]
        [HttpGet("dashboard")]
        public async Task<IActionResult> GetDashboardRequests()
        {
            int userId;
            try
            {
                userId = GetUserIdOrThrow();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Unable to resolve user id for /dashboard");
                return Unauthorized(new { message = "Invalid auth token: unable to resolve user id." });
            }

            // Pending approvals assigned to me
            var assigned = await _db.Approvals
                .Where(a => a.ApproverId == userId && a.Status == "Pending")
                .Join(_db.FundRequests,
                      a => a.FundRequestId,
                      fr => fr.Id,
                      (a, fr) => new { a, fr })
                .Select(x => new
                {
                    Type = "Assigned",
                    ApprovalId = x.a.Id,
                    RequestTitle = x.fr.RequestTitle,
                    Status = x.a.Status,
                    CurrentLevel = x.a.Level,
                    Amount = x.fr.Amount,
                    WorkflowName = x.fr.Workflow != null ? x.fr.Workflow.Name : null,
                    DepartmentName = x.fr.Department != null ? x.fr.Department.Name : null,
                    x.fr.CreatedAt,
                    NeededBy = x.fr.NeededBy,                   // surface NeededBy
                    LastActionDate = x.a.ActionedAt,
                    InitiatedBy   = _db.Users.Where(u => u.Id == x.fr.InitiatorId)
                                         .Select(u => u.FullName)
                                         .FirstOrDefault()
                })
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();

            // Requests I initiated
            var initiated = await _db.FundRequests
                .Include(fr => fr.Workflow)
                .Include(fr => fr.Department)
                .Where(fr => fr.InitiatorId == userId)
                .Select(fr => new
                {
                    fr.Id,
                    RequestTitle   = fr.RequestTitle,
                    fr.Status,
                    fr.CurrentLevel,
                    fr.Amount,
                    WorkflowName   = fr.Workflow != null   ? fr.Workflow.Name   : null,
                    DepartmentName = fr.Department != null ? fr.Department.Name : null,
                    fr.CreatedAt,
                    NeededBy       = fr.NeededBy,
                    LastActionDate = _db.Approvals
                        .Where(a => a.FundRequestId == fr.Id && a.ActionedAt != null)
                        .Max(a => (DateTime?)a.ActionedAt)
                })
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            // ASP.NET default JSON options will camelCase these properties.
            return Ok(new { assigned, initiated });
        }

        // ------------------ RESUBMIT ------------------
        public class ResubmitFundRequestDto
        {
            public string? Title { get; set; }
            public string? Description { get; set; }
            public decimal? Amount { get; set; }
            public int? WorkflowId { get; set; }
            public int? DepartmentId { get; set; } // kept for backward compat but ignored if lock is on
            public int? ProjectId { get; set; }
            public List<FieldDto>? Fields { get; set; }

            public class FieldDto
            {
                public string FieldName { get; set; } = default!;
                // For most fields, FieldValue is a string. For HyperlinkUrl, allow List<string>.
                public object? FieldValue { get; set; }
            }
        }

        [Authorize]
        [HttpPut("{id:int}/resubmit")]
        public async Task<IActionResult> Resubmit(int id, [FromBody] ResubmitFundRequestDto dto)
        {
            try
            {
            var userId = GetUserIdOrThrow();

            var fr = await _db.FundRequests
                .Include(x => x.Fields)
                .Include(x => x.Approvals)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (fr == null)
            {
                _logger.LogError($"Resubmit failed: FundRequest {id} not found.");
                return NotFound();
            }
            if (fr.InitiatorId != userId)
            {
                _logger.LogError($"Resubmit failed: User {userId} is not the initiator of FundRequest {id}.");
                return Forbid();
            }

            // Block only when already Approved. Otherwise allow resubmission.
            if (string.Equals(fr.Status, "Approved", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogError($"Resubmit failed: FundRequest {id} is already approved.");
                return BadRequest(new { message = "This request has already been approved and cannot be resubmitted." });
            }

            // Workflow locked on resubmit
            if (dto.WorkflowId.HasValue && dto.WorkflowId.Value != fr.WorkflowId)
            {
                _logger.LogError($"Resubmit failed: WorkflowId mismatch. dto.WorkflowId={dto.WorkflowId}, fr.WorkflowId={fr.WorkflowId}");
                return BadRequest(new { message = "Workflow cannot be changed on resubmission." });
            }

            // Department stays server-owned (derived at create time)
            bool lockDepartmentOnResubmit = true;
            if (lockDepartmentOnResubmit && dto.DepartmentId.HasValue && dto.DepartmentId.Value != fr.DepartmentId)
            {
                _logger.LogError($"Resubmit failed: DepartmentId mismatch. dto.DepartmentId={dto.DepartmentId}, fr.DepartmentId={fr.DepartmentId}");
                return BadRequest(new { message = "Department cannot be changed on resubmission." });
            }

            if (!string.IsNullOrWhiteSpace(dto.Title)) fr.RequestTitle = dto.Title!.Trim();
            if (dto.Description != null) fr.Description = dto.Description!;

            if (dto.Amount.HasValue)
            {
                if (dto.Amount.Value <= 0)
                {
                    _logger.LogError($"Resubmit failed: Amount must be greater than 0. dto.Amount={dto.Amount}");
                    return BadRequest(new { message = "Amount must be greater than 0." });
                }
                fr.Amount = dto.Amount.Value;
            }

            if (!lockDepartmentOnResubmit && dto.DepartmentId.HasValue)
                fr.DepartmentId = dto.DepartmentId.Value;

            // Project optional on resubmit (int column): 0 means clear
            if (dto.ProjectId.HasValue)
            {
                if (dto.ProjectId.Value == 0)
                {
                    fr.ProjectId = 0; // clear for non-nullable int
                }
                else
                {
                    var projOk = await _db.Projects.AnyAsync(p => p.Id == dto.ProjectId.Value, HttpContext.RequestAborted);
                    if (!projOk)
                    {
                        _logger.LogError($"Resubmit failed: Invalid ProjectId {dto.ProjectId}");
                        return BadRequest(new { message = "Invalid ProjectId." });
                    }
                    fr.ProjectId = dto.ProjectId.Value;
                }
            }

            if (dto.Fields != null)
            {
                try
                {
                    _db.FundRequestFields.RemoveRange(fr.Fields);
                    fr.Fields = dto.Fields.Select(f => {
                        string valueStr;
                        if (string.Equals(f.FieldName, "HyperlinkUrl", StringComparison.OrdinalIgnoreCase))
                        {
                            // Accept List<string> or string for HyperlinkUrl
                            if (f.FieldValue is System.Text.Json.JsonElement je && je.ValueKind == System.Text.Json.JsonValueKind.Array)
                            {
                                var urls = System.Text.Json.JsonSerializer.Deserialize<List<string>>(je.GetRawText());
                                valueStr = System.Text.Json.JsonSerializer.Serialize(urls ?? new List<string>());
                            }
                            else if (f.FieldValue is List<string> list)
                            {
                                valueStr = System.Text.Json.JsonSerializer.Serialize(list);
                            }
                            else if (f.FieldValue is string s)
                            {
                                // Accept comma-separated string for backward compat
                                valueStr = System.Text.Json.JsonSerializer.Serialize(s.Split(',', System.StringSplitOptions.RemoveEmptyEntries | System.StringSplitOptions.TrimEntries));
                            }
                            else
                            {
                                valueStr = System.Text.Json.JsonSerializer.Serialize(new List<string>());
                            }
                        }
                        else
                        {
                            valueStr = f.FieldValue?.ToString() ?? string.Empty;
                        }
                        return new FundRequestField
                        {
                            FundRequestId = fr.Id,
                            FieldName = f.FieldName,
                            FieldValue = valueStr
                        };
                    }).ToList();

                    // ✅ Update NeededBy if caller supplied "ApprovalBy"
                    var approvalByRaw = dto.Fields
                        .FirstOrDefault(f => string.Equals(f.FieldName, "ApprovalBy", StringComparison.OrdinalIgnoreCase))
                        ?.FieldValue?.ToString();
                    var parsed = ParseDate(approvalByRaw);
                    if (parsed.HasValue) fr.NeededBy = parsed;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Resubmit failed: Error processing fields. Payload: {System.Text.Json.JsonSerializer.Serialize(dto.Fields)}");
                    return BadRequest(new { message = "Error processing fields: " + ex.Message });
                }
            }

            // Reset flow
            fr.Status = "Pending";
            fr.CurrentLevel = 1;

            // Remove old pending approvals
            var oldPendings = fr.Approvals.Where(a => a.Status == "Pending").ToList();
            if (oldPendings.Count > 0)
                _db.Approvals.RemoveRange(oldPendings);

            // Resolve first real approver
            var steps = await _db.WorkflowSteps
                .Where(ws => ws.WorkflowId == fr.WorkflowId)
                .OrderBy(ws => ws.Sequence)
                .ToListAsync(HttpContext.RequestAborted);

            var firstRealStep = steps.FirstOrDefault(s => !_approverResolver.IsInitiatorStep(s));
            if (firstRealStep == null)
            {
                _logger.LogError($"Resubmit failed: No approver steps defined for workflow {fr.WorkflowId}");
                return BadRequest("No approver steps defined for this workflow.");
            }

            (int approverId, string approverName, int stepDesignationId) resolution;
            try
            {
                resolution = await _approverResolver.ResolveAsync(
                    firstRealStep, userId, fr.ProjectId, fr.DepartmentId, HttpContext.RequestAborted);
            }
            catch (InvalidOperationException ex)
            {
                var pd = new ProblemDetails
                {
                    Title = "Approver resolution failed",
                    Detail = ex.Message,
                    Status = StatusCodes.Status422UnprocessableEntity
                };
                _logger.LogError($"Resubmit failed: Approver resolution failed. {ex.Message}");
                return UnprocessableEntity(pd);
            }

            // Save + notify with execution strategy + transaction
            var strategy = _db.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await using var tx = await _db.Database.BeginTransactionAsync(HttpContext.RequestAborted);
                try
                {
                    _db.Approvals.Add(new Approval
                    {
                        FundRequestId = fr.Id,
                        Level = firstRealStep.Sequence.GetValueOrDefault(1),
                        ApproverId = resolution.approverId,
                        Status = "Pending",
                        AssignedAt = DateTime.UtcNow
                    });

                    fr.CurrentLevel = firstRealStep.Sequence.GetValueOrDefault(1);

                    await _db.SaveChangesAsync(HttpContext.RequestAborted);

                    await _notificationOrchestrator.OnInitiatedAsync(
                        fr.Id,
                        userId,
                        resolution.approverId,
                        HttpContext.RequestAborted);

                    await _db.SaveChangesAsync(HttpContext.RequestAborted);
                    await tx.CommitAsync(HttpContext.RequestAborted);
                }
                catch (Exception ex)
                {
                    await tx.RollbackAsync(HttpContext.RequestAborted);
                    _logger.LogError(ex, $"Resubmit failed: Transaction error for FundRequest {fr.Id}");
                    throw;
                }
            });

            return Ok(new { message = "Resubmitted", id = fr.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Resubmit failed: Unexpected error. Payload: {System.Text.Json.JsonSerializer.Serialize(dto)}");
                return BadRequest(new { message = "Unexpected error: " + ex.Message });
            }
        }
    }
}
