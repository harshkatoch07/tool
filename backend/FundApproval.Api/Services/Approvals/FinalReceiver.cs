// FILE: Services/Approvals/FinalReceiver.cs
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using FundApproval.Api.Data;
using FundApproval.Api.Models;

namespace FundApproval.Api.Services.Approvals
{
    public interface IFinalReceiverProvider
    {
        Task<List<User>> GetFinalReceiversAsync(
            int workflowId, int? projectId, int? departmentId, CancellationToken ct);
    }

    public class FinalReceiverProvider : IFinalReceiverProvider
    {
        private readonly AppDbContext _db;
        public FinalReceiverProvider(AppDbContext db) { _db = db; }

        public async Task<List<User>> GetFinalReceiversAsync(
            int workflowId, int? projectId, int? departmentId, CancellationToken ct)
        {
            // 1) Pick up final receivers from WorkflowSteps (preferred)
            var stepDesignationIds = await _db.WorkflowSteps
                .AsNoTracking()
                .Where(ws => ws.WorkflowId == workflowId
                             && ((ws.IsFinalReceiver ?? false) || ws.StepName == "Final Receiver")
                             && ws.DesignationId > 0)
                .Select(ws => ws.DesignationId)
                .Distinct()
                .ToListAsync(ct);

            var stepDesignationNames = await _db.WorkflowSteps
                .AsNoTracking()
                .Where(ws => ws.WorkflowId == workflowId
                             && ((ws.IsFinalReceiver ?? false) || ws.StepName == "Final Receiver")
                             && ws.DesignationName != null && ws.DesignationName != "")
                .Select(ws => ws.DesignationName!)
                .Distinct()
                .ToListAsync(ct);

            // 2) Merge legacy WorkflowFinalReceivers (back-compat)
            var wfrRows = await _db.WorkflowFinalReceivers
                .AsNoTracking()
                .Where(x => x.WorkflowId == workflowId)
                .ToListAsync(ct);

            var explicitUserIds = wfrRows
                .Select(r => r.UserId) // int non-nullable
                .Where(id => id > 0)
                .Distinct()
                .ToList();

            var wfrDesignationNames = wfrRows
                .Select(r => (r.DesignationName ?? "").Trim())
                .Where(n => n.Length > 0)
                .Distinct()
                .ToList();

            if (wfrDesignationNames.Count > 0)
            {
                stepDesignationNames = stepDesignationNames
                    .Concat(wfrDesignationNames)
                    .Distinct()
                    .ToList();
            }

            // 3) Build user queries from all channels
            var explicitUsersQ = _db.Users.AsNoTracking()
                .Where(u => explicitUserIds.Contains(u.Id));

            var byDesignationIdQ = _db.Users.AsNoTracking()
                .Where(u => stepDesignationIds.Contains(u.DesignationId));

            var byDesignationNameQ = _db.Users.AsNoTracking()
                .Where(u => u.DesignationName != null && stepDesignationNames.Contains(u.DesignationName));

            // Department scoping
            if (departmentId.HasValue)
            {
                var dep = departmentId.Value;
                explicitUsersQ     = explicitUsersQ.Where(u => u.DepartmentId == dep);
                byDesignationIdQ   = byDesignationIdQ.Where(u => u.DepartmentId == dep);
                byDesignationNameQ = byDesignationNameQ.Where(u => u.DepartmentId == dep);
            }

            // Project scoping: support both legacy Users.ProjectId and UserProjects mapping
            if (projectId.HasValue)
{
    var pid = projectId.Value;

    // Users mapped via legacy Users.ProjectId (keep as-is)
    explicitUsersQ     = explicitUsersQ.Where(u => u.ProjectId == pid);
    byDesignationIdQ   = byDesignationIdQ.Where(u => u.ProjectId == pid);
    byDesignationNameQ = byDesignationNameQ.Where(u => u.ProjectId == pid);

    // NEW: include users mapped via UserProjects (email-based)
    var projectEmails = await _db.UserProjects
        .AsNoTracking()
        .Where(up => up.ProjectId == pid)
        .Select(up => up.EmailID) // ← email-based
        .Distinct()
        .ToListAsync(ct);

    if (projectEmails.Any())
    {
        explicitUsersQ     = explicitUsersQ.Union(_db.Users.AsNoTracking().Where(u => projectEmails.Contains(u.Email)));
        byDesignationIdQ   = byDesignationIdQ.Union(_db.Users.AsNoTracking().Where(u => projectEmails.Contains(u.Email)));
        byDesignationNameQ = byDesignationNameQ.Union(_db.Users.AsNoTracking().Where(u => projectEmails.Contains(u.Email)));
    }
}

            var explicitUsers     = await explicitUsersQ.ToListAsync(ct);
            var byDesignationId   = await byDesignationIdQ.ToListAsync(ct);
            var byDesignationName = await byDesignationNameQ.ToListAsync(ct);

            // 4) Merge distinct
            return explicitUsers
                .Concat(byDesignationId)
                .Concat(byDesignationName)
                .GroupBy(u => u.Id)
                .Select(g => g.First())
                .OrderBy(u => u.FullName)
                .ToList();
        }
    }
}
