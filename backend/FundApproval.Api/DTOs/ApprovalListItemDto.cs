public class ApprovalListItemDto
{
    public int FundRequestId { get; set; }
    public int? ApprovalId { get; set; }

    public string Approvals { get; set; } = "";   // Request Title
    public string Particulars { get; set; } = ""; // Workflow Name

    public string? InitiatedBy { get; set; }
    public DateTime InitiatedDate { get; set; }

    public DateTime? LastActionDate { get; set; }
    public DateTime? ApprovalNeededByDate { get; set; }

    public string ApprovalStatus { get; set; } = "";

    public bool CanAct { get; set; }
    public bool ShowRetry { get; set; }
}
