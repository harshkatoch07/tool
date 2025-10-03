using System;
using System.Collections.Generic;

namespace FundApproval.Api.DTOs
{
    public class FundRequestDetailsDto
    {
        public int Id { get; set; }
        public string? RequestTitle { get; set; }
        public string? Description { get; set; }
        public decimal? Amount { get; set; }
        public string? Status { get; set; }
        public int? CurrentLevel { get; set; }
        public DateTime CreatedAt { get; set; }

        // ✅ Recently added to match your controller
        public int WorkflowId { get; set; }
        public int DepartmentId { get; set; }

        public string? WorkflowName { get; set; }
        public string? DepartmentName { get; set; }
        public string? ProjectName { get; set; }

        public List<FieldDto> Fields { get; set; } = new();
        public List<ApprovalDto> Approvals { get; set; } = new();

        public class FieldDto
        {
            public int Id { get; set; }
            public string FieldName { get; set; } = default!;
            public string? FieldValue { get; set; }
        }

        public class ApprovalDto
        {
            public int Id { get; set; }
            public int? Level { get; set; }
            public int? ApproverId { get; set; }

            // ✅ New property for showing actual name instead of "User #id"
            public string? ApproverName { get; set; }

            public string? Status { get; set; }
            public string? Comments { get; set; }
            public DateTime? ActionedAt { get; set; }
        }
    }
}
