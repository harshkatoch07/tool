namespace FundApproval.Api.DTOs
{
    public class UpdateWorkflowStepDto
    {
        public string? StepName { get; set; }
        public int? Sequence { get; set; }
        public int? SLAHours { get; set; }
        public bool? AutoApprove { get; set; }
        public bool? IsFinalReceiver { get; set; }
        public int? DesignationId { get; set; }
    }
}
