using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace FundApproval.Api.DTOs
{
    public class CreateWorkflowDto
    {
        public string Name { get; set; } = default!;
        public string? Description { get; set; }
        public int DepartmentId { get; set; }
        public string? Template { get; set; }
        public string? TextBoxName { get; set; }
        public bool IsActive { get; set; } = true;

        [JsonPropertyName("initiatorDesignationId")]
        public int InitiatorDesignationId { get; set; }

        [JsonPropertyName("initiatorSlaHours")]
        public int InitiatorSlaHours { get; set; } = 0;

        public List<ApproverInDto> Approvers { get; set; } = new();
        public List<FinalReceiverInDto> FinalReceivers { get; set; } = new();
    }
}