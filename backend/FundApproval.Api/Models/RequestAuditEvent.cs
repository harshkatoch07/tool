namespace FundApproval.Api.Models
{
    public class RequestAuditEvent
    {
        public long Id { get; set; }
        public int RequestId { get; set; }
        public int? StepId { get; set; }
        public int? AssigneeUserId { get; set; }
        public int ActorUserId { get; set; }
        public string EventType { get; set; } = null!;
        public string? MetaJson { get; set; }
        public DateTime OccurredAtUtc { get; set; }
    }
}
