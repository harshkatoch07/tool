using System;
using System.Collections.Generic;

namespace FundApproval.Api.Models
{
    public class Workflow
    {
        public int WorkflowId { get; set; }
        public string Name { get; set; }
        public string? Description { get; set; }
        public int DepartmentId { get; set; }
        public Department? Department { get; set; }
        public string? Template { get; set; }
        public string? TextBoxName { get; set; }
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ModifiedAt { get; set; }
        public string? ModifiedBy { get; set; }

        // Navigation properties (no JsonIgnore here)
        public ICollection<WorkflowStep> Steps { get; set; } = new List<WorkflowStep>();
        public ICollection<WorkflowFinalReceiver> FinalReceivers { get; set; } = new List<WorkflowFinalReceiver>();
    }
}
