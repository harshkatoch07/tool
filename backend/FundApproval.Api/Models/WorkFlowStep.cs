namespace FundApproval.Api.Models
{
    public class WorkflowStep
    {
        public int StepId { get; set; }
        public int WorkflowId { get; set; }

        public string StepName { get; set; } = "";

        // ✅ align with SQL INT
        public int? Sequence { get; set; }
        public int? SLAHours { get; set; }

        public bool? AutoApprove { get; set; }
        public bool? IsFinalReceiver { get; set; }

        public int? DesignationId { get; set; }
        public string? DesignationName { get; set; }

        public string? AssignedUserName { get; set; }

        public Workflow Workflow { get; set; } = default!;
        public Designation? Designation { get; set; }
    }
}
