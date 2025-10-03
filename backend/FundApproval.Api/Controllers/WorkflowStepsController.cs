using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FundApproval.Api.Data;
using FundApproval.Api.DTOs;
using FundApproval.Api.Services.Lookups;

namespace FundApproval.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class WorkflowStepsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IDesignationLookup _lookup;

        public WorkflowStepsController(AppDbContext db, IDesignationLookup lookup)
        {
            _db = db;
            _lookup = lookup;
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateWorkflowStepDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var wfExists = await _db.Workflows.AnyAsync(w => w.WorkflowId == dto.WorkflowId);
            if (!wfExists) return BadRequest("Workflow not found.");

            var dname = await _lookup.GetNameByIdAsync(dto.DesignationId);
            if (string.IsNullOrWhiteSpace(dname)) return BadRequest("Invalid DesignationId.");

            var step = new Models.WorkflowStep
            {
                WorkflowId = dto.WorkflowId,
                StepName = dto.StepName,
                Sequence = dto.Sequence,
                SLAHours = dto.SLAHours,
                AutoApprove = dto.AutoApprove,
                IsFinalReceiver = dto.IsFinalReceiver,
                DesignationId = dto.DesignationId,
                DesignationName = dname,
                AssignedUserName = string.Empty
            };

            _db.WorkflowSteps.Add(step);
            await _db.SaveChangesAsync();

            return Ok(new WorkflowStepDto
            {
                StepId = step.StepId,
                WorkflowId = step.WorkflowId,              // ✅ present
                StepName = step.StepName,
                Sequence = step.Sequence.HasValue ? (int)step.Sequence.Value : 0,
                SLAHours = step.SLAHours.HasValue ? (int)step.SLAHours.Value : 0,             // ✅ fix: int? → int
                AutoApprove = step.AutoApprove ?? false,
                IsFinalReceiver = step.IsFinalReceiver ?? false,
                DesignationId = step.DesignationId ?? 0,
                DesignationName = step.DesignationName ?? "",
                AssignedUserName = step.AssignedUserName ?? ""
            });
        }

        [HttpPut("{stepId:int}")]
        public async Task<IActionResult> Update(int stepId, [FromBody] UpdateWorkflowStepDto dto)
        {
            var step = await _db.WorkflowSteps.FirstOrDefaultAsync(s => s.StepId == stepId);
            if (step == null) return NotFound();

            if (!string.IsNullOrWhiteSpace(dto.StepName)) step.StepName = dto.StepName.Trim();
            if (dto.Sequence.HasValue) step.Sequence = dto.Sequence.Value;
            if (dto.SLAHours.HasValue) step.SLAHours =  dto.SLAHours.Value;
            if (dto.AutoApprove.HasValue) step.AutoApprove = dto.AutoApprove.Value;
            if (dto.IsFinalReceiver.HasValue) step.IsFinalReceiver = dto.IsFinalReceiver.Value;

            if (dto.DesignationId.HasValue)
            {
                var dname = await _lookup.GetNameByIdAsync(dto.DesignationId.Value);
                if (string.IsNullOrWhiteSpace(dname)) return BadRequest("Invalid DesignationId.");
                step.DesignationId = dto.DesignationId.Value;
                step.DesignationName = dname;
            }

            await _db.SaveChangesAsync();

            return Ok(new WorkflowStepDto
            {
                StepId = step.StepId,
                WorkflowId = step.WorkflowId,              // ✅ present
                StepName = step.StepName,
                Sequence = step.Sequence.HasValue ? (int)step.Sequence.Value : 0,
                SLAHours = step.SLAHours.HasValue ? (int)step.SLAHours.Value : 0,             // ✅ fix: int? → int
                AutoApprove = step.AutoApprove ?? false,
                IsFinalReceiver = step.IsFinalReceiver ?? false,
                DesignationId = step.DesignationId ?? 0,
                DesignationName = step.DesignationName ?? "",
                AssignedUserName = step.AssignedUserName ?? ""
            });
        }
    }
}
