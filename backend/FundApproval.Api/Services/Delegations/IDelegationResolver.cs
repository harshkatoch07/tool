// FILE: FundApproval.Api/Services/Delegations/IDelegationResolver.cs
using System.Threading;
using System.Threading.Tasks;

namespace FundApproval.Api.Services.Delegations
{
    public interface IDelegationResolver
    {
        /// <summary>
        /// Returns the effective assignee for an intended approver.
        /// Follows active delegation chain (if any). If none, returns intendedUserId as-is.
        /// </summary>
        Task<int> ResolveAssigneeAsync(int intendedUserId, CancellationToken ct);
    }
}
