using System;

namespace FundApproval.Api.Models
{
    public class AuditLog
    {
        public int Id { get; set; }

        // Canonical columns (use these everywhere)
        public string Event { get; set; } = "";           // e.g. "Assigned", "Approved", "AttachmentViewed"
        public string Entity { get; set; } = "";          // e.g. "Approval", "FundRequest", "Attachment"

        public int? EntityId { get; set; }                // e.g. Approval.Id or Attachment.Id (nullable)
        public int? ActorId { get; set; }                 // User who did the action
        public string? ActorName { get; set; }            // Optional, if you want to store a name
        public string? Comments { get; set; }             // Free text or JSON details
        public DateTime CreatedAt { get; set; }           // UTC timestamp
        public string? Ip { get; set; }                   // Optional IP if captured
    }
}
