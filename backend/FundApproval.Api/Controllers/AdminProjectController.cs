// Controllers/AdminProjectController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FundApproval.Api.Data;

namespace FundApproval.Api.Controllers
{
    [ApiController]
    [Route("api/admin/projects")]
    public class AdminProjectController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ILogger<AdminProjectController> _logger;
        public AdminProjectController(AppDbContext db, ILogger<AdminProjectController> logger)
        {
            _db = db;
            _logger = logger;
        }

        public sealed class ProjectDto
        {
            public int ProjectId { get; set; }
            public string ProjectName { get; set; } = string.Empty;
        }

        // GET /api/admin/projects
        [Authorize] // keep/adjust as you prefer
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ProjectDto>>> GetAllProjects(CancellationToken ct)
        {
            var items = await _db.Projects
                .AsNoTracking()
                .OrderBy(p => p.Name)
                .Select(p => new ProjectDto
                {
                    ProjectId = p.Id,         // Id maps to ProjectID
                    ProjectName = p.Name      // Name maps to ProjectName
                })
                .ToListAsync(ct);

            return Ok(items);
        }
    }
}
