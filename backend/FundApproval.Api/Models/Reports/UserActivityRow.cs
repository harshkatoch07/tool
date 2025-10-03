// Models/Reports/UserActivityRow.cs
using System;

namespace FundApproval.Api.Models
{
    // Keyless projection support type. It carries both legacy and new columns.
    public class UserActivityRow
    {
        // Legacy columns (used by old LINQ in AppDbContext)
        public int RequestId { get; set; }
        public string? StepName { get; set; }
        public DateTime? AssignedAtUtc { get; set; }
        public DateTime? FirstOpenedAtUtc { get; set; }
        public DateTime? FirstAttachmentAtUtc { get; set; }
        public DateTime? DecisionAtUtc { get; set; }
        public int? Minutes_AssignToDecision { get; set; }
        public int? Minutes_OpenToDecision { get; set; }

        // New report columns (used by ReportsController)
        public int FundRequestId { get; set; }
        public string RequestTitle { get; set; } = "";
        public string WorkflowName { get; set; } = "";
        public string ProjectName { get; set; } = "";
        public string DepartmentName { get; set; } = "";
        public string ApproverName { get; set; } = "";
        public DateTime? AssignedAt { get; set; }
        public DateTime? FirstOpenedAt { get; set; }
        public int? FirstOpenedLatencySecs { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public int? ApprovalLatencySecs { get; set; }
        public string Decision { get; set; } = "";
        public int AttachmentViewsCount { get; set; }
        public DateTime? AttachmentFirstViewedAt { get; set; }
    }
}
