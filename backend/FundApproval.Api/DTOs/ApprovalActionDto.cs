// DTOs/ApprovalActionDto.cs
namespace FundApproval.Api.DTOs
{
    public sealed class ApprovalActionDto
    {
        public string Action { get; set; }    // "Approve" | "Reject" | "SendBack"
        public string Comments { get; set; }
        public long? FundRequestId { get; set; }   // <- optional, used for fallback
    }
}
