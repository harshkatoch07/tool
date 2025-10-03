using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace FundApproval.Api.DTOs
{
    public class UpdateWorkflowDto
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public int? DepartmentId { get; set; }
        public string? Template { get; set; }
        public string? TextBoxName { get; set; }
        public bool IsActive { get; set; } = true;
        public string? ModifiedBy { get; set; }

        [JsonPropertyName("initiatorDesignationId")]
        public int? InitiatorDesignationId { get; set; }

        [JsonPropertyName("initiatorSlaHours")]
        public int? InitiatorSlaHours { get; set; }

        public List<ApproverInDto>? Approvers { get; set; }
        public List<FinalReceiverInDto>? FinalReceivers { get; set; }
    }
}
