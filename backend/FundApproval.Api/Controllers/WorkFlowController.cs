// FILE: FundApproval.Api/Controllers/WorkFlowController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FundApproval.Api.Data;
using FundApproval.Api.Models;
using FundApproval.Api.DTOs;
using System.Security.Claims;

namespace FundApproval.Api.Controllers
{
    [ApiController]
    [Route("api/workflow")]
    public class WorkFlowController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILogger<WorkFlowController> _logger;

        public WorkFlowController(AppDbContext context, ILogger<WorkFlowController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // ✅ Helper: safe user id extraction (no int.Parse)
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

        // GET: /api/workflow
        [Authorize]
        [HttpGet]
        public async Task<IActionResult> GetWorkflows([FromQuery] int? departmentId, [FromQuery] bool initiatorOnly = false)
        {
            int userId = 0;
            int? userDesignationId = null;

            if (initiatorOnly)
            {
                if (!TryGetUserId(out userId))
                    return Unauthorized("Missing or invalid user id claim.");

                var user = await _context.Users
                    .AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Id == userId);

                if (user == null) return Unauthorized("User not found");
                userDesignationId = user.DesignationId;
            }

            var q = _context.Workflows
                .Include(w => w.Steps)
                .Include(w => w.FinalReceivers)
                .AsSplitQuery()
                .Where(w => w.IsActive);

            if (initiatorOnly && userDesignationId.HasValue)
                q = q.Where(w => w.Steps.Any(s => s.StepName == "Initiator" && s.DesignationId == userDesignationId.Value));

            if (departmentId.HasValue)
                q = q.Where(w => w.DepartmentId == departmentId.Value);

            var list = await MapWorkflowsToDto(q).ToListAsync();
            return Ok(list);
        }

        // GET: /api/workflow/admin
        [Authorize(Roles = "Admin")]
        [HttpGet("admin")]
        public async Task<IActionResult> GetAllWorkflowsForAdmin()
        {
            var q = _context.Workflows
                .Include(w => w.Steps)
                .Include(w => w.FinalReceivers)
                .AsSplitQuery();

            var list = await MapWorkflowsToDto(q).ToListAsync();
            return Ok(list);
        }

        // GET: /api/workflow/{id}
        [Authorize]
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetWorkflow(int id, [FromQuery] bool initiatorOnly = false)
        {
            int userId = 0;
            int? userDesignationId = null;

            if (initiatorOnly)
            {
                if (!TryGetUserId(out userId))
                    return Unauthorized("Missing or invalid user id claim.");

                var user = await _context.Users
                    .AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Id == userId);

                if (user == null) return Unauthorized("User not found");
                userDesignationId = user.DesignationId;
            }

            var q = _context.Workflows
                .Include(w => w.Steps)
                .Include(w => w.FinalReceivers)
                .AsSplitQuery()
                .Where(w => w.WorkflowId == id);

            if (!User.IsInRole("Admin"))
                q = q.Where(w => w.IsActive);

            if (initiatorOnly && userDesignationId.HasValue)
                q = q.Where(w => w.Steps.Any(s => s.StepName == "Initiator" && s.DesignationId == userDesignationId.Value));

            var wf = await MapWorkflowsToDto(q).FirstOrDefaultAsync();
            if (wf == null && initiatorOnly) return Forbid("You are not the initiator of this workflow");
            if (wf == null) return NotFound();
            return Ok(wf);
        }

        // POST: /api/workflow
        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<IActionResult> CreateWorkflow([FromBody] CreateWorkflowDto dto)
        {
            LogUserClaims("CreateWorkflow");
            if (!ModelState.IsValid) return BadRequest(ModelState);
            if (dto == null) return BadRequest("Invalid workflow data");

            var initiatorDesigName = await _context.Designations
                .Where(d => d.Id == dto.InitiatorDesignationId)
                .Select(d => d.Name)
                .FirstOrDefaultAsync();

            if (string.IsNullOrWhiteSpace(initiatorDesigName))
                return BadRequest("Invalid InitiatorDesignationId");

            if (dto.Approvers?.Any(a => a.DesignationId <= 0) == true)
                return BadRequest("Each approver step must include a valid DesignationId");

            var wf = new Workflow
            {
                Name = dto.Name,
                Description = dto.Description,
                DepartmentId = dto.DepartmentId,
                Template = dto.Template,
                TextBoxName = dto.TextBoxName,
                IsActive = dto.IsActive,
                CreatedAt = DateTime.UtcNow,
                Steps = new List<WorkflowStep>(),
                FinalReceivers = new List<WorkflowFinalReceiver>()
            };

            // Initiator
            wf.Steps.Add(new WorkflowStep
            {
                StepName = "Initiator",
                Sequence = 1,
                SLAHours = dto.InitiatorSlaHours,
                AutoApprove = false,
                IsFinalReceiver = false,
                DesignationId = dto.InitiatorDesignationId,
                DesignationName = initiatorDesigName,
                AssignedUserName = string.Empty
            });

            // Approvers
            var seq = 2;
            if (dto.Approvers != null && dto.Approvers.Count > 0)
            {
                var desigIds = dto.Approvers.Select(a => a.DesignationId).Distinct().ToList();

                var desigs = await _context.Designations
                    .Where(d => desigIds.Contains(d.Id))
                    .Select(d => new { d.Id, d.Name })
                    .ToDictionaryAsync(x => x.Id, x => x.Name);

                foreach (var a in dto.Approvers)
                {
                    wf.Steps.Add(new WorkflowStep
                    {
                        StepName = string.IsNullOrWhiteSpace(a.StepName) ? $"Approver {seq - 1}" : a.StepName,
                        Sequence = seq++,
                        SLAHours = a.SlaHours ?? 0,
                        AutoApprove = a.AutoApprove ?? false,
                        IsFinalReceiver = false,
                        DesignationId = a.DesignationId,
                        DesignationName = desigs.TryGetValue(a.DesignationId, out var nm) ? nm : string.Empty,
                        AssignedUserName = string.Empty
                    });
                }
            }

            // Final Receivers (optional)
            if (dto.FinalReceivers != null && dto.FinalReceivers.Count > 0)
            {
                foreach (var r in dto.FinalReceivers)
                {
                    int? desigId = r.DesignationId;
                    if (!desigId.HasValue || desigId.Value <= 0)
                    {
                        desigId = await _context.Users
                            .Where(u => u.Id == r.UserId)
                            .Select(u => (int?)u.DesignationId)
                            .FirstOrDefaultAsync();
                    }

                    if (!desigId.HasValue)
                        return BadRequest($"Final receiver user {r.UserId} has no designation; please provide designationId.");

                    var desigName = await _context.Designations
                        .Where(d => d.Id == desigId.Value)
                        .Select(d => d.Name)
                        .FirstOrDefaultAsync() ?? initiatorDesigName;

                    wf.FinalReceivers.Add(new WorkflowFinalReceiver
                    {
                        UserId = r.UserId,
                        DesignationId = desigId.Value,
                        DesignationName = desigName
                    });
                }
            }

            _context.Workflows.Add(wf);
            await _context.SaveChangesAsync();

            var dtoOut = await MapWorkflowsToDto(_context.Workflows
                    .Include(w => w.Steps)
                    .Include(w => w.FinalReceivers)
                    .Where(w => w.WorkflowId == wf.WorkflowId))
                .FirstOrDefaultAsync();

            return Ok(dtoOut);
        }

        // PUT: /api/workflow/{id}
        [Authorize(Roles = "Admin")]
        [HttpPut("{id:int}")]
        public async Task<IActionResult> UpdateWorkflow(int id, [FromBody] UpdateWorkflowDto dto)
        {
            LogUserClaims("UpdateWorkflow");

            var wf = await _context.Workflows
                .Include(w => w.Steps)
                .Include(w => w.FinalReceivers)
                .FirstOrDefaultAsync(w => w.WorkflowId == id);

            if (wf == null) return NotFound("Workflow not found");

            if (dto.DepartmentId.HasValue) wf.DepartmentId = dto.DepartmentId.Value;

            wf.Name = dto.Name ?? wf.Name;
            wf.Description = dto.Description ?? wf.Description;
            wf.Template = dto.Template ?? wf.Template;
            wf.TextBoxName = dto.TextBoxName ?? wf.TextBoxName;
            wf.IsActive = dto.IsActive;
            wf.ModifiedBy = dto.ModifiedBy ?? wf.ModifiedBy;
            wf.ModifiedAt = DateTime.UtcNow;

            if (!dto.InitiatorDesignationId.HasValue)
                return BadRequest("InitiatorDesignationId is required for update");

            var initiatorDesigName = await _context.Designations
                .Where(d => d.Id == dto.InitiatorDesignationId.Value)
                .Select(d => d.Name)
                .FirstOrDefaultAsync();

            if (string.IsNullOrWhiteSpace(initiatorDesigName))
                return BadRequest("Invalid InitiatorDesignationId");

            // Rebuild steps
            _context.WorkflowSteps.RemoveRange(wf.Steps);
            var newSteps = new List<WorkflowStep>
            {
                new WorkflowStep
                {
                    StepName = "Initiator",
                    Sequence = 1,
                    SLAHours = dto.InitiatorSlaHours ?? 0,
                    AutoApprove = false,
                    IsFinalReceiver = false,
                    DesignationId = dto.InitiatorDesignationId.Value,
                    DesignationName = initiatorDesigName,
                    AssignedUserName = string.Empty
                }
            };

            var seq = 2;
            if (dto.Approvers != null && dto.Approvers.Count > 0)
            {
                var desigIds = dto.Approvers.Select(a => a.DesignationId).Distinct().ToList();

                var desigs = await _context.Designations
                    .Where(d => desigIds.Contains(d.Id))
                    .Select(d => new { d.Id, d.Name })
                    .ToDictionaryAsync(x => x.Id, x => x.Name);

                foreach (var a in dto.Approvers)
                {
                    if (a.DesignationId <= 0) return BadRequest("Approver.DesignationId is required");
                    newSteps.Add(new WorkflowStep
                    {
                        StepName = string.IsNullOrWhiteSpace(a.StepName) ? $"Approver {seq - 1}" : a.StepName,
                        Sequence = seq++,
                        SLAHours = a.SlaHours ?? 0,
                        AutoApprove = a.AutoApprove ?? false,
                        IsFinalReceiver = false,
                        DesignationId = a.DesignationId,
                        DesignationName = desigs.TryGetValue(a.DesignationId, out var nm) ? nm : string.Empty,
                        AssignedUserName = string.Empty
                    });
                }
            }

            wf.Steps = newSteps;

            // Rebuild Final Receivers
            _context.WorkflowFinalReceivers.RemoveRange(wf.FinalReceivers);
            if (dto.FinalReceivers != null && dto.FinalReceivers.Count > 0)
            {
                foreach (var r in dto.FinalReceivers)
                {
                    int? desigId = r.DesignationId;
                    if (!desigId.HasValue || desigId.Value <= 0)
                    {
                        desigId = await _context.Users
                            .Where(u => u.Id == r.UserId)
                            .Select(u => (int?)u.DesignationId)
                            .FirstOrDefaultAsync();
                    }

                    if (!desigId.HasValue)
                        return BadRequest($"Final receiver user {r.UserId} has no designation; please provide designationId.");

                    var desigName = await _context.Designations
                        .Where(d => d.Id == desigId.Value)
                        .Select(d => d.Name)
                        .FirstOrDefaultAsync() ?? initiatorDesigName;

                    wf.FinalReceivers.Add(new WorkflowFinalReceiver
                    {
                        UserId = r.UserId,
                        DesignationId = desigId.Value,
                        DesignationName = desigName
                    });
                }
            }

            await _context.SaveChangesAsync();

            var dtoOut = await MapWorkflowsToDto(
                    _context.Workflows
                        .Include(w => w.Steps)
                        .Include(w => w.FinalReceivers)
                        .Where(w => w.WorkflowId == id))
                .FirstOrDefaultAsync();

            return Ok(dtoOut);
        }

        // DELETE: /api/workflow/{id}
        [Authorize(Roles = "Admin")]
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteWorkflow(int id)
        {
            LogUserClaims("DeleteWorkflow");

            var wf = await _context.Workflows.FindAsync(id);
            if (wf == null) return NotFound();

            wf.IsActive = false;
            await _context.SaveChangesAsync();
            return Ok();
        }

        // LOOKUPS

        // GET: /api/workflow/designations
        [Authorize]
        [HttpGet("designations")]
        public async Task<IActionResult> GetDesignations([FromQuery] string q = "")
        {
            var list = await _context.Designations
                .Where(d => string.IsNullOrEmpty(q) || d.Name.Contains(q))
                .OrderBy(d => d.Name)
                .Select(d => new { id = d.Id, name = d.Name })
                .ToListAsync();

            return Ok(list);
        }

        // GET: /api/workflow/users/by-designation?designationId=## OR ?designation=Name
        [Authorize]
        [HttpGet("users/by-designation")]
        public async Task<IActionResult> GetUsersByDesignation([FromQuery] int? designationId, [FromQuery] string? designation = null)
        {
            var q = _context.Users.AsQueryable();

            if (designationId.HasValue)
                q = q.Where(u => u.DesignationId == designationId.Value);
            else if (!string.IsNullOrWhiteSpace(designation))
                q = q.Where(u => u.DesignationName == designation);
            else
                return Ok(Array.Empty<object>());

            var users = await q.OrderBy(u => u.FullName)
                .Select(u => new
                {
                    id = u.Id,
                    fullName = u.FullName,
                    designationId = u.DesignationId,
                    designationName = u.DesignationName
                })
                .ToListAsync();

            return Ok(users);
        }

        private IQueryable<WorkflowDto> MapWorkflowsToDto(IQueryable<Workflow> query)
        {
            return query.Select(w => new WorkflowDto
            {
                WorkflowId = w.WorkflowId,
                Name = w.Name ?? string.Empty,
                Description = w.Description ?? string.Empty,
                DepartmentId = w.DepartmentId,
                Template = w.Template ?? string.Empty,
                TextBoxName = w.TextBoxName ?? string.Empty,
                IsActive = w.IsActive,
                CreatedAt = w.CreatedAt,
                ModifiedAt = w.ModifiedAt,
                ModifiedBy = w.ModifiedBy ?? string.Empty,

                Steps = w.Steps
                    .OrderBy(s => s.Sequence ?? 0)
                    .Select(s => new WorkflowStepDto
                    {
                        StepId = s.StepId,
                        WorkflowId = s.WorkflowId,
                        StepName = s.StepName ?? string.Empty,
                        Sequence = s.Sequence ?? 0,
                        SLAHours = s.SLAHours ?? 0,
                        AutoApprove = s.AutoApprove ?? false,
                        IsFinalReceiver = s.IsFinalReceiver ?? false,
                        DesignationName = s.DesignationName ?? string.Empty,
                        DesignationId = s.DesignationId ?? 0,
                        AssignedUserName = s.AssignedUserName ?? string.Empty
                    }).ToList(),

                FinalReceivers = w.FinalReceivers
                    .Select(fr => new WorkflowFinalReceiverDto
                    {
                        Id = fr.Id,
                        UserId = fr.UserId,
                        DesignationId = fr.DesignationId,
                        DesignationName = fr.DesignationName
                    }).ToList(),

                // If no explicit user is assigned, show the designation instead of "Not Assigned"
                InitiatorFullName = w.Steps
                    .Where(s => s.StepName == "Initiator")
                    .Select(s =>
                        !string.IsNullOrWhiteSpace(s.AssignedUserName)
                            ? s.AssignedUserName
                            : (!string.IsNullOrWhiteSpace(s.DesignationName) ? s.DesignationName : "Not Assigned")
                    )
                    .FirstOrDefault() ?? "Not Assigned",

                InitiatorDesignation = w.Steps
                    .Where(s => s.StepName == "Initiator")
                    .Select(s => string.IsNullOrWhiteSpace(s.DesignationName) ? null : s.DesignationName)
                    .FirstOrDefault() ?? string.Empty,

                InitiatorDesignationId = w.Steps
                    .Where(s => s.StepName == "Initiator")
                    .Select(s => s.DesignationId ?? 0)
                    .FirstOrDefault(),

                InitiatorSlaHours = w.Steps
                    .Where(s => s.StepName == "Initiator")
                    .Select(s => s.SLAHours ?? 0)
                    .FirstOrDefault()
            });
        }

        private void LogUserClaims(string action)
        {
            var username = User.Identity?.Name;
            var role = User.FindFirstValue(ClaimTypes.Role);
            var userId = User.FindFirstValue("UserId") ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "(none)";
            _logger.LogInformation("🔐 [{Action}] User: {Username}, UserId: {UserId}, Role: {Role}", action, username, userId, role);
        }
    }
}
