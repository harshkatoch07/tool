using System;

namespace FundApproval.Api.Services.Models
{
    public class ReportMetaDto
    {
        public int ReportId { get; set; }
        public string Title { get; set; } = "";
        public string Subtitle { get; set; } = "";
        public DateTime GeneratedAt { get; set; }
        public string[] Sections { get; set; } = Array.Empty<string>();
    }

    public class ReportBinary
    {
        public byte[] Content { get; set; } = Array.Empty<byte>();
    }
}
