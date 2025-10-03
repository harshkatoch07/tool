// FILE: Services/Approvals/ApproverResolver.cs
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using FundApproval.Api.Data;
using FundApproval.Api.Models;

namespace FundApproval.Api.Services.Approvals
{
    public interface IApproverResolver
    {
        bool IsInitiatorStep(WorkflowStep step);
        Task<(int approverId, string approverName, int stepDesignationId)> ResolveAsync(
            WorkflowStep step, int initiatorUserId, int? projectId, int? departmentId, CancellationToken ct);
    }

    public class ApproverResolver : IApproverResolver
    {
        private readonly AppDbContext _db;
        private readonly bool _allowFallbackLookup; // allow global (org-wide) lookup if scoped has no match

        // simple POCO to avoid nullable tuples (compat with older C#)
        private sealed class Candidate
        {
            public int Id { get; set; }
            public string Name { get; set; }
        }

        public ApproverResolver(AppDbContext db, Microsoft.Extensions.Configuration.IConfiguration config)
        {
            _db = db;
            _allowFallbackLookup = config?.GetValue<bool>("Approvals:AllowFallbackLookup", true) ?? true;
        }

        public bool IsInitiatorStep(WorkflowStep step)
        {
            var name = (step.StepName ?? "").Trim();
            var assigned = (step.AssignedUserName ?? "").Trim();
            return name.Equals("Initiator", StringComparison.OrdinalIgnoreCase)
                || assigned.Equals("Initiator", StringComparison.OrdinalIgnoreCase)
                || assigned.Equals("Default Initiator", StringComparison.OrdinalIgnoreCase);
        }

        public async Task<(int approverId, string approverName, int stepDesignationId)> ResolveAsync(
            WorkflowStep step, int initiatorUserId, int? projectId, int? departmentId, CancellationToken ct)
        {
            // 1) Initiator step → approver is the initiator
            if (IsInitiatorStep(step))
            {
                var initiator = await _db.Users.AsNoTracking()
                    .Where(u => u.Id == initiatorUserId)
                    .Select(u => new { u.Id, u.FullName, u.DesignationId })
                    .FirstOrDefaultAsync(ct);

                if (initiator == null)
                    throw new InvalidOperationException("Initiator user not found.");
                if (initiator.DesignationId == null)
                    throw new InvalidOperationException("Initiator has no DesignationId.");

                return (initiator.Id, initiator.FullName, initiator.DesignationId.Value);
            }

            // 2) Determine step designation
            int? stepDesignationId = step.DesignationId;

            // 3) Fallback via AssignedUserName → user.DesignationId
            if (stepDesignationId == null)
            {
                var uname = (step.AssignedUserName ?? "").Trim();
                if (!string.IsNullOrEmpty(uname))
                {
                    stepDesignationId = await _db.Users.AsNoTracking()
                        .Where(u => u.Username == uname)
                        .Select(u => (int?)u.DesignationId)
                        .FirstOrDefaultAsync(ct);
                }
            }

            if (stepDesignationId == null)
                throw new InvalidOperationException(
                    "Step " + step.StepId + " has no DesignationId and no resolvable AssignedUserName.");

            // ---------- Query builders (ALL via _db.Users -> Product_MST_UserSource) ----------
           IQueryable<Candidate> BuildUsersQuery(bool scoped)
{
    var q = _db.Users.AsNoTracking().Where(u => u.DesignationId == stepDesignationId);

    if (scoped)
    {
       // if (departmentId.HasValue)
           // q = q.Where(u => u.DepartmentId == departmentId);

        // ✅ Only scope by project when > 0
        if (projectId.HasValue && projectId.Value > 0)
        {
            var pid = projectId.Value;
            q = q.Where(u => !string.IsNullOrWhiteSpace(u.Email) &&
                             _db.UserProjects.Any(up =>
                                 up.ProjectId == pid &&
                                 up.EmailID.Trim().ToLower() == u.Email!.Trim().ToLower()));
        }
    }

    return q.Select(u => new Candidate { Id = u.Id, Name = u.FullName });
}


            // Server-side pick using pending count
            async Task<Candidate> PickAsync(IQueryable<Candidate> people)
            {
                var pendings = _db.Approvals.AsNoTracking()
                    .Where(a => a.Status == "Pending")
                    .GroupBy(a => a.ApproverId)
                    .Select(g => new { ApproverId = g.Key, Count = g.Count() });

                return await people
                    .GroupJoin(
                        pendings,
                        p => p.Id,
                        x => x.ApproverId,
                        (p, px) => new { p.Id, p.Name, Count = px.Select(z => z.Count).FirstOrDefault() }
                    )
                    .OrderBy(x => x.Count)   // null -> 0
                    .ThenBy(x => x.Id)
                    .Select(x => new Candidate { Id = x.Id, Name = x.Name })
                    .FirstOrDefaultAsync(ct);
            }

            // Try: Users (scoped) → Users (global)
           Candidate winner = await PickAsync(BuildUsersQuery(true));
if (winner == null)
{
    // If a project was requested, DO NOT fallback globally—force a clear error.
    if (projectId.GetValueOrDefault() > 0)
        throw new InvalidOperationException(
            $"No approver found for DesignationId={stepDesignationId} in ProjectId={projectId.Value}. " +
            "Ensure the user is mapped to this project in UserProjects.");

    // Only if no project is specified do we allow global fallback (configurable)
    if (_allowFallbackLookup)
        winner = await PickAsync(BuildUsersQuery(false));
}

            if (winner == null)
            {
                var where =
                    (departmentId.HasValue ? (" dept=" + departmentId.Value) : " any dept") +
                    (projectId.HasValue ? (" proj=" + projectId.Value) : " any proj");

                throw new InvalidOperationException(
                    "No user found for DesignationId=" + stepDesignationId + " (" + where + ").");
            }

            return (winner.Id, winner.Name, stepDesignationId.Value);
        }
    }
}
