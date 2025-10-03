// FILE: FundApproval.Api/Controllers/ProjectsController.cs
using System.Security.Claims;
using FundApproval.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FundApproval.Api.Controllers
{
    public sealed class AssignedProjectDto
    {
        public int ProjectId { get; set; }
        public string ProjectName { get; set; } = string.Empty;
    }

    [ApiController]
    [Route("api/projects")]
    public class ProjectsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ILogger<ProjectsController> _logger;

        public ProjectsController(AppDbContext db, ILogger<ProjectsController> logger)
        {
            _db = db;
            _logger = logger;
        }

        // GET /api/projects/assigned
        [Authorize]
        [HttpGet("assigned")]
        public async Task<ActionResult<IEnumerable<AssignedProjectDto>>> GetAssignedProjects(CancellationToken ct)
        {
            // 1) Read email from token
            var email = GetEmailFromClaims(User);
            string? debugWhy = null;

            // 2) Fallback: resolve email via userId→Users.Email (if claim missing)
            if (string.IsNullOrWhiteSpace(email))
            {
                var userId = GetUserIdFromClaims(User);
                if (userId.HasValue)
                {
                    email = await _db.Users.AsNoTracking()
                        .Where(u => u.Id == userId.Value)
                        .Select(u => u.Email)
                        .FirstOrDefaultAsync(ct);
                    debugWhy = "fallback_userid_lookup";
                }
            }

            if (string.IsNullOrWhiteSpace(email))
            {
                _logger.LogWarning("Assigned projects request missing email (and fallback failed).");
                return Unauthorized(new { title = "Missing email in token." });
            }

            var norm = email.Trim();

            // 3) Query by EMAIL (UserProjects.EmailID) → join Projects(ProjectID)
            var items = await (from up in _db.UserProjects.AsNoTracking()
                               join p in _db.Projects.AsNoTracking() on up.ProjectId equals p.Id
                               where up.EmailID.Trim() == norm
                               orderby p.Name
                               select new AssignedProjectDto
                               {
                                   ProjectId = p.Id,
                                   ProjectName = p.Name
                               })
                              .ToListAsync(ct);

            // 4) Optional fallback: if no rows via UserProjects, try Users.ProjectId (legacy single-project)
            if (items.Count == 0)
            {
                var userProjectId = await _db.Users.AsNoTracking()
                    .Where(u => u.Email == norm)
                    .Select(u => u.ProjectId)
                    .FirstOrDefaultAsync(ct);

                if (userProjectId.HasValue && userProjectId.Value > 0)
                {
                    var one = await _db.Projects.AsNoTracking()
                        .Where(p => p.Id == userProjectId.Value)
                        .Select(p => new AssignedProjectDto { ProjectId = p.Id, ProjectName = p.Name })
                        .FirstOrDefaultAsync(ct);

                    if (one != null) items.Add(one);
                }
            }

            // 5) Helpful debug (visible in server logs only)
            _logger.LogInformation("Assigned projects for {Email} via {Path} => {Count}",
                norm, debugWhy ?? "email_claim", items.Count);

            return Ok(items);
        }

        private static string? GetEmailFromClaims(ClaimsPrincipal user)
            => user.FindFirst("email")?.Value
               ?? user.FindFirst(ClaimTypes.Email)?.Value
               ?? user.FindFirst("preferred_username")?.Value;

        private static int? GetUserIdFromClaims(ClaimsPrincipal user)
        {
            var c = user.FindFirst("userId")
                 ?? user.FindFirst(ClaimTypes.NameIdentifier)
                 ?? user.FindFirst(ClaimTypes.NameIdentifier) // duplicated to emphasize
                 ?? user.FindFirst("sub");
            return int.TryParse(c?.Value, out var id) ? id : (int?)null;
        }
    }
}
