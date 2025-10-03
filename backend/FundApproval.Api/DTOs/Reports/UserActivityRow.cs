namespace FundApproval.Api.DTOs.Reports
{
    // Keyless DTO for the user-activity report
    public class UserActivityRow
    {
        public int FundRequestId { get; set; }
        public string? RequestTitle { get; set; }
        public string? WorkflowName { get; set; }
        public string? ProjectName { get; set; }
        public string? DepartmentName { get; set; }

        public string? ApproverName { get; set; }

        public DateTime? AssignedAt { get; set; }
        public DateTime? FirstOpenedAt { get; set; }
        public int? FirstOpenedLatencySecs { get; set; }

        public DateTime? ApprovedAt { get; set; }
        public int? ApprovalLatencySecs { get; set; }

        public string? Decision { get; set; }

        public int AttachmentViewsCount { get; set; }
        public DateTime? AttachmentFirstViewedAt { get; set; }
    }
}
