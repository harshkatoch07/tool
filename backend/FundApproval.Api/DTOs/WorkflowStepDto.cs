namespace FundApproval.Api.DTOs
{
    public class WorkflowStepDto
    {
        public int StepId { get; set; }
        public int WorkflowId { get; set; }  // used by WorkflowStepsController
        public string StepName { get; set; } = "";
        public int Sequence { get; set; }
        public int SLAHours { get; set; }
        public bool AutoApprove { get; set; }
        public bool IsFinalReceiver { get; set; }
        public string DesignationName { get; set; } = "";
        public int DesignationId { get; set; }
        public string AssignedUserName { get; set; } = "";
    }
}
