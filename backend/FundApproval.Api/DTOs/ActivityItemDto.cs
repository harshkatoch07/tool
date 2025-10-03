namespace FundApproval.Api.DTOs
{
    public class ActivityItemDto
    {
        public string Type { get; set; } = "";          // Submitted | Approved | Rejected | Pending
        public int FundRequestId { get; set; }
        public string Title { get; set; } = "";
        public string WorkflowName { get; set; } = "";
        public string Status { get; set; } = "";        // Current request/approval status
        public string Actor { get; set; } = "";         // Who did it (or current approver)
        public int? Level { get; set; }                 // Approval level if applicable
        public DateTime OccurredAt { get; set; }        // When it happened
    }
}
