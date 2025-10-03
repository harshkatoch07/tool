namespace FundApproval.Api.DTOs.Reports
{
    public class DecisionReportRowDto
    {
        public int FundRequestId { get; set; }
        public string Title { get; set; } = "";
        public string? Department { get; set; }
        public string Status { get; set; } = "";
        public decimal Amount { get; set; }
        public string Initiator { get; set; } = "";
        public string? DecidedBy { get; set; }
        public DateTime? DecidedAt { get; set; }
    }
}
