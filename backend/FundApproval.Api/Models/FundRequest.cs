    using System;
    using System.Collections.Generic;
    using System.ComponentModel.DataAnnotations;
    using System.ComponentModel.DataAnnotations.Schema;

    namespace FundApproval.Api.Models
    {
    public class FundRequest
    {
        [Key]
        public int Id { get; set; }

        [Required, StringLength(256)]
        public string RequestTitle { get; set; } = default!;

        public string? Description { get; set; }

        // ✅ Amount stored as decimal(18,2) and must be > 0
        [Column(TypeName = "decimal(18,2)")]
        [Range(typeof(decimal), "0.01", "79228162514264337593543950335",
            ErrorMessage = "Amount must be greater than 0.")]
        public decimal? Amount { get; set; }

        [Required]
        public int InitiatorId { get; set; }

        [Required]
        public int WorkflowId { get; set; }

        [Required]
        public int DepartmentId { get; set; }

        public int? ProjectId { get; set; }

        [Required, StringLength(32)]
        public string Status { get; set; } = "Pending";

        public int CurrentLevel { get; set; } = 0;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ModifiedAt { get; set; } 
        public User? Initiator { get; set; }  // maps to FundRequests.ModifiedAt (datetime, nullable)



        // Navigation / children
        public virtual ICollection<FundRequestField> Fields { get; set; } = new List<FundRequestField>();
        public virtual ICollection<Approval> Approvals { get; set; } = new List<Approval>();
        public virtual List<Attachment> Attachments { get; set; } = new();

        // References
        public virtual Workflow Workflow { get; set; } = default!;
        public virtual Department Department { get; set; } = default!;
        public virtual Project? Project { get; set; }
            // add this property (nullable DateTime)
public DateTime? NeededBy { get; set; }

        }
    }
