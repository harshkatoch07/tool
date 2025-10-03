using System;

namespace FundApproval.Api.DTOs
{
    public class RecentActivityDto
    {
        public int RequestId { get; set; }
        public string Title { get; set; } = "";
        public string? Description { get; set; }
        public decimal Amount { get; set; }

        public int InitiatorId { get; set; }
        public string? InitiatorName { get; set; }

        public int DepartmentId { get; set; }
        public string? DepartmentName { get; set; }

        public int WorkflowId { get; set; }
        public string Status { get; set; } = "";
        public int CurrentLevel { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? ModifiedAt { get; set; }

        public string ActivityType { get; set; } = "";
        public DateTime ActivityAt { get; set; }
        public int? ActorUserId { get; set; }
        public string? ActorName { get; set; }
        public string? ActorComments { get; set; }

        public string? CurrentStepDesignation { get; set; }
        public double WaitingHoursOnCurrentStep { get; set; }
    }
}
