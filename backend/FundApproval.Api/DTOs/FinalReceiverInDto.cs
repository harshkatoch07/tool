namespace FundApproval.Api.DTOs
{
    public class FinalReceiverInDto
    {
        public int UserId { get; set; }

        // allow client to pass it, but we’ll derive from user if missing
        public int? DesignationId { get; set; }
    }
}
