// Controllers/UserAdminController.cs
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using FundApproval.Api.Data;
using FundApproval.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FundApproval.Api.Controllers
{
    [ApiController]
    [Route("api/admin/users")]
    public class UserAdminController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ILogger<UserAdminController> _logger;

        public UserAdminController(AppDbContext db, ILogger<UserAdminController> logger)
        {
            _db = db;
            _logger = logger;
        }

        // --- sanity check: GET /api/admin/users/ping ---
        [HttpGet("ping")]
        public IActionResult Ping() => Ok(new { ok = true, where = nameof(UserAdminController) });

        // =========================================================
        // Minimal user lookup for dropdowns (delegation, etc.)
        // GET /api/admin/users/lookup?q=ali&projectId=123&onlyActive=true&top=20
        // =========================================================
        public record UserLookupDto(int Id, string FullName, string? Email);

        [Authorize]
        [HttpGet("lookup")]
        public async Task<IActionResult> Lookup(
            [FromQuery] string? q,
            [FromQuery] int? projectId,
            [FromQuery] bool onlyActive = true,
            [FromQuery] int top = 20)
        {
            top = top <= 0 ? 20 : top;

            // Base query
            var users = _db.Users.AsNoTracking();

            if (onlyActive)
            {
                // Requires User.IsActive mapping on your model.
                users = users.Where(u => u.IsActive == true);   // ✅ works with bool?

            }

            if (!string.IsNullOrWhiteSpace(q))
            {
                var term = q.Trim();
                users = users.Where(u =>
                    (u.FullName != null && u.FullName.Contains(term)) ||
                    (u.Email != null && u.Email.Contains(term)) ||
                    (u.Username != null && u.Username.Contains(term)));
            }

            // Optional filter by project membership (email-based join table dbo.UserProjects)
            if (projectId.HasValue && projectId.Value > 0)
            {
                var pid = projectId.Value;
                users =
                    from u in users
                    join up in _db.UserProjects.AsNoTracking()
                        on u.Email equals up.EmailID
                    where up.ProjectId == pid
                    select u;
            }

            var list = await users
                .OrderBy(u => u.FullName)
                .ThenBy(u => u.Email)
                .ThenBy(u => u.Id)
                .Take(top)
                .Select(u => new UserLookupDto(u.Id, u.FullName ?? $"User#{u.Id}", u.Email))
                .ToListAsync();

            return Ok(list);
        }

        // ================= Password =================
        public class PasswordDto
        {
            public string? NewPassword { get; set; }
        }

        // PUT /api/admin/users/{id}/password
        [Authorize] // optionally: [Authorize(Roles = "Admin")]
        [HttpPut("{id:int}/password")]
        public async Task<IActionResult> SetPassword(int id, [FromBody] PasswordDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto?.NewPassword))
                return BadRequest("New password is required.");

            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound("User not found.");

            // NOTE: PasswordHash maps to DB column "Password". Add hashing later as needed.
            user.PasswordHash = dto.NewPassword;
            await _db.SaveChangesAsync();

            return NoContent();
        }

        // ============ Projects (assignments) ============
        public class AssignProjectsDto
        {
            public List<int>? ProjectIds { get; set; }
        }

        // GET /api/admin/users/{id}/projects
        [Authorize]
        [HttpGet("{id:int}/projects")]
        public async Task<IActionResult> GetAssignments(int id)
        {
            // fetch the user's email (this is what the join table uses)
            var user = await _db.Users.AsNoTracking()
                .Where(u => u.Id == id)
                .Select(u => new { u.Id, u.Email })
                .FirstOrDefaultAsync();

            if (user == null) return NotFound("User not found.");
            if (string.IsNullOrWhiteSpace(user.Email))
                return BadRequest("User has no EmailID; cannot resolve project assignments.");

            var ids = await _db.UserProjects
                .AsNoTracking()
                .Where(up => up.EmailID == user.Email) // ← email-based
                .Select(up => up.ProjectId)
                .ToListAsync();

            var projects = await _db.Projects
                .Where(p => ids.Contains(p.Id))
                .Select(p => new { ProjectId = p.Id, ProjectName = p.Name })
                .OrderBy(p => p.ProjectName)
                .ToListAsync();

            return Ok(new { userId = id, email = user.Email, projectIds = ids, projects });
        }

        // PUT /api/admin/users/{id}/projects   Body: { "projectIds": [1,2,3] }
        [Authorize]
        [HttpPut("{id:int}/projects")]
        public async Task<IActionResult> SetAssignments(int id, [FromBody] AssignProjectsDto dto)
        {
            var user = await _db.Users.AsNoTracking()
                .Where(u => u.Id == id)
                .Select(u => new { u.Id, u.Email })
                .FirstOrDefaultAsync();

            if (user == null) return NotFound("User not found.");
            if (string.IsNullOrWhiteSpace(user.Email))
                return BadRequest("User has no EmailID; cannot assign projects.");

            var desired = (dto?.ProjectIds ?? new List<int>())
                .Distinct()
                .Where(pid => pid > 0)
                .ToList();

            var validIds = await _db.Projects
                .Where(p => desired.Contains(p.Id))
                .Select(p => p.Id)
                .ToListAsync();

            var existing = await _db.UserProjects
                .Where(up => up.EmailID == user.Email) // ← email-based
                .ToListAsync();

            var toRemove = existing.Where(up => !validIds.Contains(up.ProjectId)).ToList();
            if (toRemove.Count > 0) _db.UserProjects.RemoveRange(toRemove);

            var existingIds = existing.Select(up => up.ProjectId).ToHashSet();
            var toAdd = validIds
                .Where(pid => !existingIds.Contains(pid))
                .Select(pid => new UserProject { ProjectId = pid, EmailID = user.Email }) // ← email-based
                .ToList();

            if (toAdd.Count > 0) await _db.UserProjects.AddRangeAsync(toAdd);
            await _db.SaveChangesAsync();

            return Ok(new { userId = id, email = user.Email, projectIds = validIds });
        }

        // ============ Status (Active / Inactive) ============
        public class UpdateUserStatusDto
        {
            public bool IsActive { get; set; }
        }

        // PUT /api/admin/users/{id}/status
        // Body: { "isActive": true|false }
        // IMPORTANT: Write directly to dbo.Product_MST_UserSource so it persists with your listing.
        [Authorize]
[HttpPut("{id:int}/status")]
public async Task<IActionResult> SetStatus(int id, [FromBody] UpdateUserStatusDto dto)
{
    var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
    if (user == null) return NotFound("User not found.");

    user.IsActive = dto.IsActive;    // writes IsActiveFlag = 1 or 0
    await _db.SaveChangesAsync();
    return NoContent();
} 

        // PATCH /api/admin/users/{id}
        // Accepts partial updates; we handle { "isActive": true|false } and update the same table.
        [Authorize] // optionally: [Authorize(Roles = "Admin")]
        [HttpPatch("{id:int}")]
        public async Task<IActionResult> PatchUser(
            int id,
            [FromBody] JsonElement patch,
            CancellationToken ct)
        {
            bool? isActive = null;

            if (patch.ValueKind == JsonValueKind.Object &&
                patch.TryGetProperty("isActive", out var isActiveProp) &&
                (isActiveProp.ValueKind == JsonValueKind.True || isActiveProp.ValueKind == JsonValueKind.False))
            {
                isActive = isActiveProp.GetBoolean();
            }

            if (isActive.HasValue)
            {
                var affected = await _db.Database.ExecuteSqlInterpolatedAsync($@"
                    UPDATE dbo.Product_MST_UserSource
                    SET IsActive = {(isActive.Value ? 1 : 0)}
                    WHERE UserID = {id};
                ", ct);

                if (affected == 0) return NotFound("User not found.");
            }

            return NoContent();
        }
    }
}
