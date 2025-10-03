// Models/EmailOutbox.cs
namespace FundApproval.Api.Models
{
    public class EmailOutbox
    {
        public int Id { get; set; }
        public string ToAddress { get; set; } = "";
        public string? Cc { get; set; }
        public string Subject { get; set; } = "";
        public string BodyHtml { get; set; } = "";
        public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
        public DateTime? SentUtc { get; set; }
        public int Attempts { get; set; }
        public string? LastError { get; set; }
    }
}
