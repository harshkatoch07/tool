using System.Text.Json.Serialization;

namespace FundApproval.Api.DTOs
{
    public class ApproverInDto
    {
        public string? StepName { get; set; }

        [JsonPropertyName("slaHours")]
        public int? SlaHours { get; set; }

        public bool? AutoApprove { get; set; }

        [JsonPropertyName("designationId")]
        public int DesignationId { get; set; }

        public int? AssignedUserId { get; set; }
    }
}
