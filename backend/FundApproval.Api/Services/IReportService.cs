using System.Threading;
using System.Threading.Tasks;
using FundApproval.Api.Services.Models;

namespace FundApproval.Api.Services
{
    public interface IReportService
    {
        Task<ReportMetaDto?> GetReportMetaAsync(int reportId, CancellationToken ct = default);
        Task<ReportBinary?> GeneratePdfAsync(int reportId, CancellationToken ct = default);
    }
}
