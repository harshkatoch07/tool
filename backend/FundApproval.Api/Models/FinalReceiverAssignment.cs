using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FundApproval.Api.Models
{
    public enum FinalReceiverStatus
    {
        Pending = 0,
        Completed = 1,   // the finisher
        AutoClosed = 2   // closed because someone else finished
    }

    public class FinalReceiverAssignment
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int FundRequestId { get; set; }
        public FundRequest FundRequest { get; set; } = null!;

        [Required]
        public int UserId { get; set; }  // your Users table PK

        [Required]
        public FinalReceiverStatus Status { get; set; } = FinalReceiverStatus.Pending;

        public DateTime? CompletedAtUtc { get; set; }
    }
}
