namespace FundApproval.Api.Models
{
    public class WorkflowFinalReceiver
    {
        public int Id { get; set; }

        // FKs
        public int WorkflowId { get; set; }
        public int UserId { get; set; }

        // 🔴 REQUIRED by DB
        public int DesignationId { get; set; }

        // optional label
        public string DesignationName { get; set; } = string.Empty;

        // navs
        public Workflow? Workflow { get; set; }
        public User? User { get; set; }
        public Designation? Designation { get; set; }
    }
}
