using FundApproval.Api.Data;
using FundApproval.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FundApproval.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FormSchemasController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IFormSchemaBuilder _builder;

        public FormSchemasController(AppDbContext db, IFormSchemaBuilder builder)
        {
            _db = db;
            _builder = builder;
        }

        [HttpGet("by-workflow/{workflowId:int}")]
        public async Task<IActionResult> ByWorkflow(int workflowId)
        {
            var wf = await _db.Workflows.FirstOrDefaultAsync(w => w.WorkflowId == workflowId);
            if (wf == null) return NotFound();
            if (string.IsNullOrWhiteSpace(wf.Template)) wf.Template = "Header_P";
            var dto = _builder.Build(wf);
            return Ok(dto);
        }
    }
}
