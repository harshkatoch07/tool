namespace FundApproval.Api.DTOs
{
    public class WorkflowStepInDto
    {
        public string? StepName { get; set; } // defaults to "Approver N"
        public int SlaHours { get; set; } = 0;
        public bool AutoApprove { get; set; } = false;
        public int DesignationId { get; set; }  // ✅ required
        public int? AssignedUserId { get; set; }
    }
}