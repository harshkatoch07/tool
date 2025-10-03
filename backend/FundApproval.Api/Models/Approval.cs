using System;

namespace FundApproval.Api.Models
{
    // Maps to dbo.Approvals
    public class Approval
    {
        public int Id { get; set; }

        public int FundRequestId { get; set; }
        public FundRequest? FundRequest { get; set; }

        public int ApproverId { get; set; }
        public User? Approver { get; set; }

        public int Level { get; set; }

        // Allowed by your CHECK constraint (plus FinalReceiver if you keep it):
        // Pending | Approved | Rejected | SentBack | FinalReceiver
        public string Status { get; set; } = "Pending";

        public string? Comments { get; set; }

        // Timestamps
        public DateTime? AssignedAt { get; set; }   // when this approval was created/assigned
        public DateTime? ActionedAt { get; set; }   // when it was acted upon
        public DateTime? ApprovedAt { get; set; }   // optional separate approved time

        // Optional override column present in DB
        public int? OverriddenUserId { get; set; }
    }
}
