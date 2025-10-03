// Controllers/ReportsController.cs
using System;
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

namespace FundApproval.Api.Controllers
{
    [Authorize(Roles = "Admin")]
    [ApiController]
    [Route("api/reports")]
    public class ReportsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public ReportsController(AppDbContext db) => _db = db;

        // GET /api/reports/user-activity?username=jdoe&userId=123&from=2025-01-01&to=2025-12-31&take=200
        [HttpGet("user-activity")]
        public async Task<IActionResult> GetUserActivity(
            [FromQuery] string? username,
            [FromQuery] int? userId,
            [FromQuery(Name = "from")] DateTime? from,
            [FromQuery(Name = "fromUtc")] DateTime? fromUtc,
            [FromQuery(Name = "to")] DateTime? to,
            [FromQuery(Name = "toUtc")] DateTime? toUtc,
            [FromQuery] int take = 200,
            CancellationToken ct = default)
        {
            int? targetUserId = userId;
            if (targetUserId is null && !string.IsNullOrWhiteSpace(username))
            {
                var uname = username.Trim();
                targetUserId = await _db.Users
                    .Where(u => u.Username == uname || u.Email == uname)
                    .Select(u => (int?)u.Id)
                    .FirstOrDefaultAsync(ct);
            }
            if (targetUserId is null)
                return BadRequest("Provide username or userId.");

            var fromFilter = fromUtc ?? from;
            var toFilter = toUtc ?? to;

            var startUtc = fromFilter?.Date;
            DateTime? endUtc = null;
            if (toFilter.HasValue)
            {
                endUtc = toFilter.Value.Date.AddDays(1).AddTicks(-1);
            }

            if (startUtc.HasValue && endUtc.HasValue && endUtc < startUtc)
            {
                return BadRequest("Invalid date range. 'to' must be on or after 'from'.");
            }

            var approvalsQuery = _db.Approvals
                .AsNoTracking()
                .Where(a => a.ApproverId == targetUserId || a.OverriddenUserId == targetUserId);

            if (startUtc.HasValue)
                approvalsQuery = approvalsQuery.Where(a => (a.AssignedAt ?? a.ActionedAt) >= startUtc.Value);
            if (endUtc.HasValue)
                approvalsQuery = approvalsQuery.Where(a => (a.AssignedAt ?? a.ActionedAt) <= endUtc.Value);

           // just before the query
var SqlSafeFloor = new DateTime(1753, 1, 1);

// ...
var approvals = await approvalsQuery
    .OrderByDescending(a => (a.AssignedAt ?? a.ActionedAt ?? SqlSafeFloor))
    .Take(Math.Clamp(take, 1, 2000))
    .Select(a => new
    {
        a.Id,
        a.Level,
        a.Status,
        a.AssignedAt,
        a.ActionedAt,
        a.ApprovedAt,
        ApproverId = a.ApproverId,
        OverriddenUserId = a.OverriddenUserId,
        FundRequestId = a.FundRequestId,
        RequestTitle = a.FundRequest!.RequestTitle,
        WorkflowName = a.FundRequest!.Workflow!.Name,
        ProjectName = a.FundRequest!.Project!.Name,
        DepartmentName = a.FundRequest!.Department!.Name
    })
    .ToListAsync(ct);


            if (approvals.Count == 0)
                return Ok(Array.Empty<UserActivityRow>());

            var approvalIds = approvals.Select(x => x.Id).ToList();

            var firstOpens = await _db.AuditLogs
                .AsNoTracking()
                .Where(l => l.Event == "ApprovalFirstOpen" && l.Entity == "Approval" && l.EntityId != null && approvalIds.Contains(l.EntityId.Value))
                .GroupBy(l => l.EntityId!.Value)
                .Select(g => new { ApprovalId = g.Key, FirstOpenedAt = g.Min(x => x.CreatedAt) })
                .ToListAsync(ct);
            var firstOpenMap = firstOpens.ToDictionary(x => x.ApprovalId, x => (DateTime?)x.FirstOpenedAt);

            // EF Core 5–7 safe: coarse LIKE on SQL, exact parse in memory
            var rawAttachViews = await _db.AuditLogs
                .AsNoTracking()
                .Where(l => l.Event == "AttachmentViewed" && l.Comments != null)
                .Where(l => EF.Functions.Like(l.Comments!, "%\"fundRequestId\":%"))
                .Select(l => new { l.Comments, l.CreatedAt })
                .ToListAsync(ct);

            var attachMap = new Dictionary<int, (int Count, DateTime? FirstViewedAt)>();
            foreach (var log in rawAttachViews)
            {
                try
                {
                    using var doc = JsonDocument.Parse(log.Comments!);
                    if (doc.RootElement.TryGetProperty("fundRequestId", out var frProp))
                    {
                        var fid = frProp.GetInt32();
                        if (!attachMap.TryGetValue(fid, out var agg))
                            attachMap[fid] = (1, log.CreatedAt);
                        else
                            attachMap[fid] = (agg.Count + 1,
                                agg.FirstViewedAt.HasValue && agg.FirstViewedAt.Value <= log.CreatedAt
                                    ? agg.FirstViewedAt
                                    : log.CreatedAt);
                    }
                }
                catch
                {
                    // ignore malformed JSON
                }
            }

            var approverIds = approvals.Select(a => a.OverriddenUserId ?? a.ApproverId).Distinct().ToList();
            var approverNames = await _db.Users
                .AsNoTracking()
                .Where(u => approverIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FullName })
                .ToListAsync(ct);
            var approverNameMap = approverNames.ToDictionary(x => x.Id, x => x.FullName ?? $"User#{x.Id}");

            var rows = approvals.Select(a =>
            {
                var approver = approverNameMap.GetValueOrDefault(a.OverriddenUserId ?? a.ApproverId, $"User#{a.OverriddenUserId ?? a.ApproverId}");
                var firstOpen = firstOpenMap.GetValueOrDefault(a.Id);
                var assignedAt = a.AssignedAt;

                int? openLatency = (assignedAt.HasValue && firstOpen.HasValue)
                    ? (int?)Convert.ToInt32((firstOpen.Value - assignedAt.Value).TotalSeconds)
                    : null;

                int? approveLatency = (assignedAt.HasValue && a.ApprovedAt.HasValue)
                    ? (int?)Convert.ToInt32((a.ApprovedAt.Value - assignedAt.Value).TotalSeconds)
                    : null;

                attachMap.TryGetValue(a.FundRequestId, out var attachStats);

                return new UserActivityRow
                {
                    FundRequestId = a.FundRequestId,
                    RequestTitle = a.RequestTitle,
                    WorkflowName = a.WorkflowName,
                    ProjectName = a.ProjectName,
                    DepartmentName = a.DepartmentName,
                    ApproverName = approver,
                    AssignedAt = assignedAt,
                    FirstOpenedAt = firstOpen,
                    FirstOpenedLatencySecs = openLatency,
                    ApprovedAt = a.ApprovedAt,
                    ApprovalLatencySecs = approveLatency,
                    Decision = a.Status,
                    AttachmentViewsCount = attachStats.Count,
                    AttachmentFirstViewedAt = attachStats.FirstViewedAt
                };
            })
            .OrderByDescending(r => r.AssignedAt ?? r.FirstOpenedAt ?? r.ApprovedAt)
            .ToList();

            return Ok(rows);
        }
    }
}


