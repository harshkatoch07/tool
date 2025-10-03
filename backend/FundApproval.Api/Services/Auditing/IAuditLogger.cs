using System.Threading;
using System.Threading.Tasks;

namespace FundApproval.Api.Services.Auditing
{
    public interface IAuditLogger
    {
        /// <summary>
        /// Flexible signature that matches existing controller call patterns.
        /// </summary>
        /// <param name="fundRequestId">FundRequest Id (not stored directly; included in serialized details)</param>
        /// <param name="entityId">Primary entity id (ApprovalId, AttachmentId, etc.)</param>
        /// <param name="actorUserId">User performing the action</param>
        /// <param name="event">Event name (e.g., "Assigned", "Approved")</param>
        /// <param name="entity">Entity name (e.g., "Approval", "Attachment")</param>
        /// <param name="details">Anonymous object or string; will be serialized to Comments</param>
        Task LogAsync(
            int fundRequestId,
            int? entityId,
            int actorUserId,
            int eventNumber,
            string entity,
            object? details = null,
            CancellationToken ct = default);
    }
}
