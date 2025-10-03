using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace FundApproval.Api.DTOs
{
    public class FundRequestDto
    {
        [Required]
        [StringLength(256, MinimumLength = 1, ErrorMessage = "Title is required.")]
        public string Title { get; set; } = default!;

        public string? Description { get; set; }

        // ✅ Amount must be > 0 (supports cents)
        [Range(typeof(decimal), "0.01", "79228162514264337593543950335",
      ErrorMessage = "Amount must be > 0")]
  public decimal? Amount { get; set; }

        // These can be null for resubmits; controller can decide what's required
        public int? WorkflowId { get; set; }
        public int? DepartmentId { get; set; }
        public int? ProjectId { get; set; }

        // Always initialize to avoid null refs
        public List<FundRequestFieldDto> Fields { get; set; } = new();
    }

    public class FundRequestFieldDto
    {
        [Required]
        public string FieldName { get; set; } = default!;

        public string? FieldValue { get; set; }
    }
}
