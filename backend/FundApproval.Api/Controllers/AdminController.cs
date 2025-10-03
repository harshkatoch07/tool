// FILE: FundApproval.Api/Controllers/AdminController.cs
using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ClosedXML.Excel;
using FundApproval.Api.Data;
using FundApproval.Api.DTOs;
using FundApproval.Api.Models;
using FundApproval.Api.Services.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace FundApproval.Api.Controllers
{
    public class CreateUserDto
    {
        public string Username { get; set; } = "";
        public string FullName { get; set; } = "";
        public string? Email { get; set; }
        public string? Password { get; set; }
        public string? Mobile { get; set; }
        public string? Gender { get; set; }
        public int Role { get; set; }
        public int? DepartmentId { get; set; }
        public int DesignationId { get; set; }
        public string? DesignationName { get; set; }
        public List<int>? ProjectIds { get; set; }
        // ✅ allow initial active flag (null => default true)
        public bool? IsActive { get; set; } = true;
    }

    public class UpdateUserDto : CreateUserDto { }

    [ApiController]
    [Route("api/admin")]
    public class AdminController : ControllerBase
    {
        private readonly ILogger<AdminController> _logger;
        private readonly AppDbContext _db;
        private readonly IPasswordHasher _hasher;
        private readonly IConfiguration _config;

        public AdminController(
            ILogger<AdminController> logger,
            AppDbContext db,
            IPasswordHasher hasher,
            IConfiguration config)
        {
            _logger = logger;
            _db = db;
            _hasher = hasher;
            _config = config;
            _logger.LogInformation("DEBUG: AdminController initialized.");
        }

        // === ADO helpers ===
        private async Task<int> TryGetTotalUsersAsync(CancellationToken ct)
        {
            try
            {
                var connStr = _config.GetConnectionString("DefaultConnection");
                if (string.IsNullOrWhiteSpace(connStr))
                    throw new InvalidOperationException("ConnectionStrings:DefaultConnection missing.");

                await using var conn = new SqlConnection(connStr);
                await conn.OpenAsync(ct);

                await using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT COUNT_BIG(1) FROM Product_MST_UserSource WITH (NOLOCK)";
                cmd.CommandType = CommandType.Text;
                cmd.CommandTimeout = 3;
                var raw = await cmd.ExecuteScalarAsync(ct);
                return Convert.ToInt32(raw);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "User count timed out; returning 0 as fallback.");
                return 0;
            }
        }

        private async Task<Dictionary<int, string?>> TryGetUserNamesAsync(IEnumerable<int> ids, CancellationToken ct)
        {
            var userIds = ids.Where(i => i > 0).Distinct().Take(500).ToList();
            var map = new Dictionary<int, string?>();
            if (userIds.Count == 0) return map;

            try
            {
                var connStr = _config.GetConnectionString("DefaultConnection");
                if (string.IsNullOrWhiteSpace(connStr))
                    throw new InvalidOperationException("ConnectionStrings:DefaultConnection missing.");

                await using var conn = new SqlConnection(connStr);
                await conn.OpenAsync(ct);

                var inList = string.Join(",", userIds);
                await using var cmd = conn.CreateCommand();
                cmd.CommandText =
                    $"SELECT UserID, FullName FROM Product_MST_UserSource WITH (NOLOCK) WHERE UserID IN ({inList})";
                cmd.CommandTimeout = 3;

                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct))
                {
                    var id = reader.IsDBNull(0) ? 0 : reader.GetInt32(0);
                    string? name = reader.IsDBNull(1) ? null : reader.GetString(1);
                    if (id > 0) map[id] = name;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Name lookup timed out; returning partial/empty map.");
            }

            return map;
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats(CancellationToken ct)
        {
            try
            {
                const string PENDING = "Pending";
                const string APPROVED = "Approved";
                const string REJECTED = "Rejected";

                var totalUsers = await TryGetTotalUsersAsync(ct);

                var pendingApprovals = await _db.Approvals
                    .AsNoTracking()
                    .Where(a => a.Status == PENDING)
                    .CountAsync(ct);

                var frAgg = await _db.FundRequests
                    .AsNoTracking()
                    .GroupBy(_ => 1)
                    .Select(g => new
                    {
                        Approved = g.Count(fr => fr.Status == APPROVED),
                        Rejected = g.Count(fr => fr.Status == REJECTED)
                    })
                    .FirstOrDefaultAsync(ct);

                var approvedRequests = frAgg?.Approved ?? 0;
                var rejectedRequests = frAgg?.Rejected ?? 0;

                return Ok(new
                {
                    totalUsers,
                    pendingApprovals,
                    approvedRequests,
                    rejectedRequests
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to compute admin stats");
                return Ok(new { totalUsers = 0, pendingApprovals = 0, approvedRequests = 0, rejectedRequests = 0 });
            }
        }

        [HttpGet("users")]
        public async Task<IActionResult> GetUsers(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] int? afterId = null,
            [FromQuery] string? q = null,
            CancellationToken ct = default)
        {
            page = page <= 0 ? 1 : page;
            pageSize = Math.Clamp(pageSize, 1, 500);

            var query = _db.Users.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(q))
            {
                var term = q.Trim();
                query = query.Where(u =>
                    EF.Functions.Like(u.Username, $"%{term}%") ||
                    EF.Functions.Like(u.FullName, $"%{term}%") ||
                    (u.Email != null && EF.Functions.Like(u.Email, $"%{term}%")) ||
                    (u.DesignationName != null && EF.Functions.Like(u.DesignationName, $"%{term}%")));
            }

            List<object> items;
            int? nextAfterId = null;

            if (afterId.HasValue)
            {
                query = query.Where(u => u.Id > afterId.Value);
                var rows = await query
                    .OrderBy(u => u.Id)
                    .Take(pageSize)
                    .Select(u => new
                    {
                        u.Id,
                        u.Username,
                        u.Email,
                        Role = (int)u.Role,
                        DepartmentId = u.DepartmentId,
                        ProjectId = u.ProjectId,
                        u.FullName,
                        u.Gender,
                        u.Mobile,
                        u.DesignationId,
                        u.DesignationName,
                        IsActive = u.IsActive // ✅ include
                    })
                    .ToListAsync(ct);

                if (rows.Count > 0) nextAfterId = rows[^1].Id;
                items = rows.Cast<object>().ToList();
            }
            else
            {
                var prev = _db.Database.GetCommandTimeout();
                _db.Database.SetCommandTimeout(60);
                try
                {
                    var rows = await query
                        .OrderBy(u => u.Id)
                        .Skip((page - 1) * pageSize)
                        .Take(pageSize)
                        .Select(u => new
                        {
                            u.Id,
                            u.Username,
                            u.Email,
                            Role = (int)u.Role,
                            DepartmentId = u.DepartmentId,
                            ProjectId = u.ProjectId,
                            u.FullName,
                            u.Gender,
                            u.Mobile,
                            u.DesignationId,
                            u.DesignationName,
                            IsActive = u.IsActive // ✅ include
                        })
                        .ToListAsync(ct);

                    if (rows.Count > 0) nextAfterId = rows[^1].Id;
                    items = rows.Cast<object>().ToList();
                }
                finally
                {
                    _db.Database.SetCommandTimeout(prev);
                }
            }

            if (nextAfterId.HasValue)
                Response.Headers["X-Next-AfterId"] = nextAfterId.Value.ToString();

            return Ok(items);
        }

        [HttpGet("users/by-designation/{designationName}")]
        public async Task<IActionResult> GetUsersByDesignation(string designationName, CancellationToken ct)
        {
            var users = await _db.Users
                .AsNoTracking()
                .Where(u => u.DesignationName == designationName)
                .Select(u => new { u.Id, u.FullName, u.Email, u.DesignationName, u.IsActive })
                .Take(500)
                .ToListAsync(ct);

            return Ok(users);
        }

        [HttpPost("users")]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto, CancellationToken ct)
        {
            if (dto == null) return BadRequest("Payload is required.");

            int designationId = 0;
            if (dto.DesignationId > 0)
            {
                designationId = await _db.Designations
                    .AsNoTracking()
                    .Where(d => d.Id == dto.DesignationId)
                    .Select(d => d.Id)
                    .FirstOrDefaultAsync(ct);
            }
            else if (!string.IsNullOrWhiteSpace(dto.DesignationName))
            {
                designationId = await _db.Designations
                    .AsNoTracking()
                    .Where(d => d.Name == dto.DesignationName.Trim())
                    .Select(d => d.Id)
                    .FirstOrDefaultAsync(ct);
            }

            if (designationId <= 0)
                return BadRequest("Invalid or missing designation.");

            var designationName = await _db.Designations
                .AsNoTracking()
                .Where(d => d.Id == designationId)
                .Select(d => d.Name)
                .FirstOrDefaultAsync(ct);

            var user = new User
            {
                Username = dto.Username?.Trim() ?? "",
                FullName = dto.FullName?.Trim() ?? "",
                Email = dto.Email?.Trim(),
                PasswordHash = string.IsNullOrWhiteSpace(dto.Password) ? null : _hasher.Hash(dto.Password),
                Mobile = dto.Mobile,
                Gender = dto.Gender,
                Role = dto.Role,
                DepartmentId = dto.DepartmentId,
                DesignationId = designationId,
                DesignationName = designationName,
                IsActive = dto.IsActive ?? true  // ✅ set
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync(ct);

            // Email-based project mapping
            var desired = (dto.ProjectIds ?? new List<int>()).Distinct().Where(id => id > 0).ToList();
            if (desired.Count > 0 && !string.IsNullOrWhiteSpace(user.Email))
            {
                var valid = await _db.Projects
                    .AsNoTracking()
                    .Where(p => desired.Contains(p.Id))
                    .Select(p => p.Id)
                    .ToListAsync(ct);

                if (valid.Count > 0)
                {
                    var rows = valid.Select(pid => new UserProject
                    {
                        ProjectId = pid,
                        EmailID = user.Email!.Trim()
                    });

                    await _db.UserProjects.AddRangeAsync(rows, ct);
                    await _db.SaveChangesAsync(ct);
                }
            }

            return Ok(new
            {
                user.Id,
                user.Username,
                user.FullName,
                user.Email,
                user.Gender,
                user.Mobile,
                user.Role,
                user.DepartmentId,
                user.DesignationId,
                user.DesignationName,
                user.IsActive
            });
        }

        [HttpPut("users/{id}")]
        public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserDto dto, CancellationToken ct)
        {
            var existing = await _db.Users.FindAsync(new object[] { id }, ct);
            if (existing == null) return NotFound();

            if (!string.IsNullOrWhiteSpace(dto.Username)) existing.Username = dto.Username.Trim();
            if (!string.IsNullOrWhiteSpace(dto.FullName)) existing.FullName = dto.FullName.Trim();
            if (!string.IsNullOrWhiteSpace(dto.Email)) existing.Email = dto.Email.Trim();
            if (!string.IsNullOrWhiteSpace(dto.Mobile)) existing.Mobile = dto.Mobile.Trim();
            if (!string.IsNullOrWhiteSpace(dto.Gender)) existing.Gender = dto.Gender.Trim();
            existing.Role = dto.Role;
            existing.DepartmentId = dto.DepartmentId;

            // ✅ allow updating IsActive when provided
            if (dto.IsActive.HasValue)
                existing.IsActive = dto.IsActive.Value;

            int? newDesignationId = null;

            if (dto.DesignationId > 0)
            {
                var exists = await _db.Designations.AsNoTracking().AnyAsync(d => d.Id == dto.DesignationId, ct);
                if (!exists) return BadRequest("Invalid designation.");
                newDesignationId = dto.DesignationId;
            }
            else if (!string.IsNullOrWhiteSpace(dto.DesignationName))
            {
                newDesignationId = await _db.Designations
                    .AsNoTracking()
                    .Where(d => d.Name == dto.DesignationName.Trim())
                    .Select(d => (int?)d.Id)
                    .FirstOrDefaultAsync(ct);

                if (!newDesignationId.HasValue)
                    return BadRequest("Invalid designation.");
            }

            if (newDesignationId.HasValue)
            {
                existing.DesignationId = newDesignationId.Value;
                existing.DesignationName = await _db.Designations
                    .AsNoTracking()
                    .Where(d => d.Id == newDesignationId.Value)
                    .Select(d => d.Name)
                    .FirstOrDefaultAsync(ct);
            }

            if (!string.IsNullOrWhiteSpace(dto.Password))
                existing.PasswordHash = _hasher.Hash(dto.Password);

            await _db.SaveChangesAsync(ct);

            // Email-based project mapping (diff & apply)
            if (dto.ProjectIds != null)
            {
                if (string.IsNullOrWhiteSpace(existing.Email))
                    return BadRequest("User has no EmailID; cannot update project assignments.");

                var normEmail = existing.Email.Trim();
                var desired = dto.ProjectIds.Distinct().Where(x => x > 0).ToList();

                var valid = await _db.Projects
                    .AsNoTracking()
                    .Where(p => desired.Contains(p.Id))
                    .Select(p => p.Id)
                    .ToListAsync(ct);

                var current = await _db.UserProjects
                    .Where(up => up.EmailID == normEmail)
                    .ToListAsync(ct);

                var toRemove = current.Where(up => !valid.Contains(up.ProjectId)).ToList();
                if (toRemove.Count > 0) _db.UserProjects.RemoveRange(toRemove);

                var existingIds = current.Select(up => up.ProjectId).ToHashSet();
                var toAdd = valid
                    .Where(pid => !existingIds.Contains(pid))
                    .Select(pid => new UserProject { ProjectId = pid, EmailID = normEmail })
                    .ToList();

                if (toAdd.Count > 0) await _db.UserProjects.AddRangeAsync(toAdd, ct);

                await _db.SaveChangesAsync(ct);
            }

            return Ok(new
            {
                existing.Id,
                existing.Username,
                existing.FullName,
                existing.Email,
                existing.Gender,
                existing.Mobile,
                existing.Role,
                existing.DepartmentId,
                existing.DesignationId,
                existing.DesignationName,
                existing.IsActive
            });
        }

        // ❌ DO NOT add a /users/{id}/status endpoint here — it already exists in UserAdminController

        [HttpDelete("users/{id}")]
        public async Task<IActionResult> DeleteUser(int id, CancellationToken ct)
        {
            var existing = await _db.Users.FindAsync(new object[] { id }, ct);
            if (existing == null) return NotFound();

            _db.Users.Remove(existing);
            await _db.SaveChangesAsync(ct);
            return NoContent();
        }

        [HttpGet("designations")]
        public async Task<IActionResult> GetDesignations(CancellationToken ct)
        {
            var designations = await _db.Designations
                .AsNoTracking()
                .Select(d => new { d.Id, d.Name })
                .ToListAsync(ct);
            return Ok(designations);
        }

        [HttpGet("departments")]
        public async Task<IActionResult> GetDepartments(CancellationToken ct)
        {
            try
            {
                var departments = await _db.Departments
                    .AsNoTracking()
                    .Select(d => new
                    {
                        Id = d.DepartmentID,
                        d.Name,
                        d.ShortName,
                        d.DepartmentHead,
                        d.IsActive
                    })
                    .ToListAsync(ct);

                return Ok(departments);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to fetch departments");
                return StatusCode(500, "Failed to fetch departments");
            }
        }

        [HttpGet("recent-activities")]
        public async Task<IActionResult> GetRecentActivities([FromQuery] int days = 14, [FromQuery] int limit = 40, CancellationToken ct = default)
        {
            try
            {
                var cutoff = DateTime.UtcNow.AddDays(-days);
                limit = Math.Clamp(limit, 1, 200);

                var frIds = await _db.FundRequests
                    .AsNoTracking()
                    .Where(fr =>
                        fr.CreatedAt >= cutoff ||
                        fr.Approvals.Any(a => a.ActionedAt != null && a.ActionedAt >= cutoff))
                    .Select(fr => new
                    {
                        fr.Id,
                        LastActivityAt = _db.Approvals
                            .Where(a => a.FundRequestId == fr.Id)
                            .Max(a => (DateTime?)a.ActionedAt) ?? fr.CreatedAt
                    })
                    .OrderByDescending(x => x.LastActivityAt)
                    .Take(limit)
                    .Select(x => x.Id)
                    .ToListAsync(ct);

                var items = await _db.FundRequests
                    .AsNoTracking()
                    .Where(fr => frIds.Contains(fr.Id))
                    .Select(fr => new
                    {
                        fr.Id,
                        fr.RequestTitle,
                        fr.Description,
                        fr.Amount,
                        fr.InitiatorId,
                        fr.WorkflowId,
                        fr.DepartmentId,
                        fr.Status,
                        fr.CurrentLevel,
                        fr.CreatedAt,
                        LastActionAt = fr.Approvals.Max(a => (DateTime?)a.ActionedAt),
                        LastAction = fr.Approvals
                            .OrderByDescending(a => a.ActionedAt)
                            .Select(a => new { a.Status, a.ActionedAt, ActorId = a.ApproverId, a.Comments })
                            .FirstOrDefault(),
                        DepartmentName = _db.Departments
                            .Where(d => d.DepartmentID == fr.DepartmentId)
                            .Select(d => d.Name)
                            .FirstOrDefault(),
                        CurrentStepDesignation = _db.WorkflowSteps
                            .Where(ws => ws.WorkflowId == fr.WorkflowId && ws.Sequence == fr.CurrentLevel)
                            .Select(ws => ws.DesignationName)
                            .FirstOrDefault()
                    })
                    .ToListAsync(ct);

                var nameIds = items
                    .Select(i => i.InitiatorId)
                    .Concat(items.Select(i => i.LastAction?.ActorId ?? 0))
                    .Where(i => i > 0)
                    .Distinct()
                    .ToList();

                var nameMap = await TryGetUserNamesAsync(nameIds, ct);
                var now = DateTime.UtcNow;

                var result = items.Select(r =>
                {
                    string activityType;
                    DateTime activityAt;
                    int? actorUserId = null;
                    string? actorName = null;
                    string? actorComments = null;

                    if (r.LastAction != null && r.LastAction.ActionedAt.HasValue)
                    {
                        activityType = r.LastAction.Status switch
                        {
                            "Approved" => "Approved",
                            "Rejected" => "Rejected",
                            "SentBack" => "SentBack",
                            "Pending" => "Pending",
                            _ => r.Status ?? "Pending"
                        };

                        activityAt = r.LastAction.ActionedAt.Value;
                        actorUserId = r.LastAction.ActorId;
                        actorName = (actorUserId.HasValue && nameMap.TryGetValue(actorUserId.Value, out var nm)) ? nm : null;
                        actorComments = r.LastAction.Comments;
                    }
                    else
                    {
                        activityType = string.IsNullOrWhiteSpace(r.Status) ? "Created" : r.Status!;
                        activityAt = r.LastActionAt ?? r.CreatedAt;
                    }

                    var since = r.LastActionAt ?? r.CreatedAt;
                    var waitingHours = (now - since).TotalHours;
                    if (waitingHours < 0) waitingHours = 0;

                    return new RecentActivityDto
                    {
                        RequestId = r.Id,
                        Title = r.RequestTitle ?? "",
                        Description = r.Description,
                        Amount = (r.Amount ?? 0m),
                        InitiatorId = r.InitiatorId,
                        InitiatorName = nameMap.TryGetValue(r.InitiatorId, out var initName) ? initName : null,
                        DepartmentId = r.DepartmentId,
                        DepartmentName = r.DepartmentName,
                        WorkflowId = r.WorkflowId,
                        Status = r.Status ?? "Pending",
                        CurrentLevel = r.CurrentLevel,
                        CreatedAt = r.CreatedAt,
                        ModifiedAt = r.LastActionAt,
                        ActivityType = activityType,
                        ActivityAt = activityAt,
                        ActorUserId = actorUserId,
                        ActorName = actorName,
                        ActorComments = actorComments,
                        CurrentStepDesignation = r.CurrentStepDesignation,
                        WaitingHoursOnCurrentStep = Math.Round(waitingHours, 2)
                    };
                })
                .OrderByDescending(r => r.ActivityAt)
                .Take(limit)
                .ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get recent activities");
                return Ok(new List<RecentActivityDto>());
            }
        }

        [HttpGet("workflows/import/template")]
        public IActionResult DownloadWorkflowTemplate()
        {
            using var wb = new XLWorkbook();
            var ws = wb.Worksheets.Add("WorkflowsTemplate");

            var headers = new[]
            {
                "Name", "Description", "DepartmentName", "IsActive",
                "Step1_Designation","Step1_Sequence","Step1_SLAHours",
                "Step2_Designation","Step2_Sequence","Step2_SLAHours"
            };

            for (int i = 0; i < headers.Length; i++)
                ws.Cell(1, i + 1).Value = headers[i];

            ws.Cell(2, 1).Value = "CapEx Approval";
            ws.Cell(2, 2).Value = "CapEx purchase flow";
            ws.Cell(2, 3).Value = "Finance";
            ws.Cell(2, 4).Value = true;
            ws.Cell(2, 5).Value = "Manager";
            ws.Cell(2, 6).Value = 2;
            ws.Cell(2, 7).Value = 24;
            ws.Cell(2, 8).Value = "Head of Finance";
            ws.Cell(2, 9).Value = 3;
            ws.Cell(2, 10).Value = 48;

            ws.Row(1).Style.Font.SetBold();
            ws.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            wb.SaveAs(stream);
            stream.Seek(0, SeekOrigin.Begin);
            return File(stream.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "WorkflowsTemplate.xlsx");
        }

        [HttpPost("workflows/import")]
        public async Task<IActionResult> ImportWorkflows(IFormFile file, CancellationToken ct)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded.");

            using var stream = new MemoryStream();
            await file.CopyToAsync(stream, ct);
            stream.Position = 0;

            using var wb = new XLWorkbook(stream);
            var ws = wb.Worksheets.FirstOrDefault();
            if (ws == null) return BadRequest("No worksheet found.");

            var headerMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var headerRow = ws.FirstRowUsed()?.RowUsed();
            if (headerRow == null) return BadRequest("Worksheet is empty.");

            foreach (var cell in headerRow.CellsUsed())
            {
                var name = cell.GetString()?.Trim();
                if (!string.IsNullOrWhiteSpace(name))
                    headerMap[name] = cell.Address.ColumnNumber;
            }

            string[] required = { "Name", "DepartmentName" };
            foreach (var req in required)
                if (!headerMap.ContainsKey(req))
                    return BadRequest($"Missing required column: {req}");

            var stepGroups = new List<(string desigCol, string seqCol, string slaCol)>();
            for (int i = 1; i <= 50; i++)
            {
                var d = $"Step{i}_Designation";
                var s = $"Step{i}_Sequence";
                var h = $"Step{i}_SLAHours";
                if (headerMap.ContainsKey(d))
                    stepGroups.Add((d, s, h));
            }
            if (stepGroups.Count == 0)
                return BadRequest("No step columns found (e.g., Step1_Designation, Step1_Sequence, Step1_SLAHours).");

            string GetString(IXLRow row, string colName)
                => headerMap.TryGetValue(colName, out var col) ? row.Cell(col).GetString()?.Trim() ?? "" : "";
            int? GetInt(IXLRow row, string colName)
            {
                if (!headerMap.TryGetValue(colName, out var col)) return null;
                var cell = row.Cell(col);
                if (cell.IsEmpty()) return null;
                if (int.TryParse(cell.GetValue<string>(), out var v)) return v;
                if (cell.DataType == XLDataType.Number) return (int)cell.GetDouble();
                return null;
            }
            bool GetBool(IXLRow row, string colName, bool fallback = true)
            {
                var s = GetString(row, colName);
                if (bool.TryParse(s, out var b)) return b;
                if (int.TryParse(s, out var i)) return i != 0;
                return fallback;
            }

            await using IDbContextTransaction tx = await _db.Database.BeginTransactionAsync(ct);

            int imported = 0;
            var rows = ws.RowsUsed().Skip(1);
            foreach (var row in rows)
            {
                if (ct.IsCancellationRequested) break;

                var name = GetString(row, "Name");
                if (string.IsNullOrWhiteSpace(name))
                    continue;

                var departmentName = GetString(row, "DepartmentName");
                if (string.IsNullOrWhiteSpace(departmentName))
                    return BadRequest($"Row {row.RowNumber()}: DepartmentName is required.");

                var isActive = headerMap.ContainsKey("IsActive") ? GetBool(row, "IsActive", true) : true;
                var description = GetString(row, "Description");

                var departmentId = await _db.Departments
                    .AsNoTracking()
                    .Where(d => d.Name == departmentName)
                    .Select(d => (int?)d.DepartmentID)
                    .FirstOrDefaultAsync(ct);

                if (!departmentId.HasValue)
                    return BadRequest($"Row {row.RowNumber()}: Department '{departmentName}' not found.");

                var wf = new Workflow
                {
                    Name = name,
                    Description = string.IsNullOrWhiteSpace(description) ? null : description,
                    DepartmentId = departmentId.Value,
                    IsActive = isActive,
                    CreatedAt = DateTime.UtcNow,
                    Steps = new List<WorkflowStep>(),
                    FinalReceivers = new List<WorkflowFinalReceiver>()
                };

                // Step 1: Initiator
                wf.Steps.Add(new WorkflowStep
                {
                    StepName = "Initiator",
                    Sequence = 1,
                    SLAHours = 0,
                    AutoApprove = false,
                    IsFinalReceiver = false,
                    DesignationId = null,
                    DesignationName = "Initiator",
                    AssignedUserName = string.Empty
                });

                foreach (var g in stepGroups)
                {
                    var desigName = GetString(row, g.desigCol);
                    if (string.IsNullOrWhiteSpace(desigName)) continue;

                    var seq = GetInt(row, g.seqCol) ?? (wf.Steps.Count + 1);
                    var sla = GetInt(row, g.slaCol) ?? 0;

                    var desig = await _db.Designations
                        .AsNoTracking()
                        .Where(d => d.Name == desigName)
                        .Select(d => new { d.Id, d.Name })
                        .FirstOrDefaultAsync(ct);

                    if (desig == null)
                        return BadRequest($"Row {row.RowNumber()}: Designation '{desigName}' not found.");

                    wf.Steps.Add(new WorkflowStep
                    {
                        StepName = $"Approver {seq - 1}",
                        Sequence = seq,
                        SLAHours = sla,
                        AutoApprove = false,
                        IsFinalReceiver = false,
                        DesignationId = desig.Id,
                        DesignationName = desig.Name,
                        AssignedUserName = string.Empty
                    });
                }

                _db.Workflows.Add(wf);
                imported++;
            }

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return Ok(new { message = $"Imported {imported} workflow(s) successfully." });
        }
    }
}
