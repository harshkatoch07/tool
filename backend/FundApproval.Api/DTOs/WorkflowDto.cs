using FundApproval.Api.DTOs;


    public class WorkflowDto
    {
        public int WorkflowId { get; set; }
        public string Name { get; set; } = "";
        public string Description { get; set; } = "";
        public int DepartmentId { get; set; }
        public string Template { get; set; } = "";
        public string TextBoxName { get; set; } = "";
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ModifiedAt { get; set; }
        public string ModifiedBy { get; set; } = "";

        public List<WorkflowStepDto> Steps { get; set; } = new();
        public List<WorkflowFinalReceiverDto> FinalReceivers { get; set; } = new();

        public string InitiatorFullName { get; set; } = "Not Assigned";
        public string InitiatorDesignation { get; set; } = "";

        // new fields so the form can prefill properly (serialized as camelCase)
        public int InitiatorDesignationId { get; set; }
        public int InitiatorSlaHours { get; set; }
    }
