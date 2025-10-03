namespace FundApproval.Api.DTOs.Reports
{
    public class FundRequestSummaryDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = "";
        public string? Description { get; set; }
        public decimal Amount { get; set; }
        public string Status { get; set; } = "";
        public string? Department { get; set; }
        public string Initiator { get; set; } = "";
        public DateTime CreatedAt { get; set; }
        public int StepsCount { get; set; }
        public int ApprovalsDone { get; set; }
        public int AttachmentsCount { get; set; }
        public string? LastDecisionStatus { get; set; }
        public string? LastDecisionBy { get; set; }
        public DateTime? LastDecisionAt { get; set; }
        public string? LastDecisionComments { get; set; }
    }
}
