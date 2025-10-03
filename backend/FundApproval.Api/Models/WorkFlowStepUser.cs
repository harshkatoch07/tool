namespace FundApproval.Api.Models
{
    public class WorkflowStepUser
    {
        public int Id { get; set; }
        public int? StepId { get; set; }
        public int? UserId { get; set; } // Nullable for flexibility

        public WorkflowStep Step { get; set; }
    }
}
