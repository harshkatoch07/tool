using System.Collections.Generic;

namespace FundApproval.Api.DTOs
{
    public class WorkflowImportDto
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public int DepartmentId { get; set; }
        public string Template { get; set; }
        public string TextBoxName { get; set; }
        public List<WorkflowStepImportDto> Steps { get; set; }
    }

    public class WorkflowStepImportDto
    {
        public string StepName { get; set; }
        public int Sequence { get; set; }
        public int SLAHours { get; set; }
        public bool AutoApprove { get; set; }
        public bool IsFinalReceiver { get; set; }
        public List<int> ApproverUserIds { get; set; }
    }
}
