namespace FundApproval.Api.DTOs
{
    public class WorkflowFinalReceiverDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }

        public int DesignationId { get; set; }      // expose for UI
        public string? DesignationName { get; set; }
    }
}
