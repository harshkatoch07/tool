using System.Text;
using System.Threading;
using System.Threading.Tasks;
using FundApproval.Api.Services.Models;

namespace FundApproval.Api.Services
{
    public class ReportService : IReportService
    {
        public Task<ReportMetaDto?> GetReportMetaAsync(int reportId, CancellationToken ct = default)
        {
            var meta = new ReportMetaDto
            {
                ReportId    = reportId,
                Title       = $"Activity Report #{reportId}",
                Subtitle    = "Recent actions, approvers, and status changes",
                GeneratedAt = DateTime.UtcNow,
                Sections    = new[] { "Overview", "Timeline", "Participants" }
            };
            return Task.FromResult<ReportMetaDto?>(meta);
        }

        public Task<ReportBinary?> GeneratePdfAsync(int reportId, CancellationToken ct = default)
        {
            var text = $"Report #{reportId} - generated {DateTime.UtcNow:u}";
            var pdf = MinimalPdf(text);
            return Task.FromResult<ReportBinary?>(new ReportBinary { Content = pdf });
        }

        // Minimal valid PDF (stub). Replace with a real generator later (e.g., QuestPDF).
        private static byte[] MinimalPdf(string text)
        {
            var content = $@"%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]
/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 68 >> stream
BT /F1 24 Tf 72 760 Td ({EscapePdf(text)}) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000064 00000 n 
0000000123 00000 n 
0000000315 00000 n 
0000000443 00000 n 
trailer << /Root 1 0 R /Size 6 >>
startxref
548
%%EOF";
            return Encoding.ASCII.GetBytes(content);
        }

        private static string EscapePdf(string s) =>
            s.Replace(@"\", @"\\").Replace("(", @"\(").Replace(")", @"\)");
    }
}
