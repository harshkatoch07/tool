namespace FundApproval.Api.Models
{
    public class Attachment
    {
        public int Id { get; set; }

        // FK
        public int FundRequestId { get; set; }
        public FundRequest FundRequest { get; set; } = null!;

        // File metadata
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = "application/octet-stream";
        public long FileSize { get; set; }

        // Where the file is stored (disk path or blob url)
        public string StoragePath { get; set; } = string.Empty;
         /// <summary>
        /// Holds the legacy relative path for attachments that pre-date <see cref="StoragePath"/>.
        /// </summary>
        public string? LegacyFilePath { get; set; }

        // Audit
        public int UploadedBy { get; set; }
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        // Optional integrity
        public string? Sha256 { get; set; }
    }
}
