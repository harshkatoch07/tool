namespace FundApproval.Api.DTOs
{
    public class WorkflowStepUserDto
    {
        public int Id { get; set; }
        public int? UserId { get; set; } // Nullable to handle missing data
    }
}
