namespace FundApproval.Api.DTOs
{
    public class CreateWorkflowStepDto
    {
        public int WorkflowId { get; set; }
        public string StepName { get; set; } = "";
        public int Sequence { get; set; }
        public int SLAHours { get; set; }
        public bool AutoApprove { get; set; }
        public bool IsFinalReceiver { get; set; }
        public int DesignationId { get; set; }
    }
}
