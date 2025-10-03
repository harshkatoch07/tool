// FILE: Services/Reports/IFundRequestPdfService.cs
using System.Threading;
using System.Threading.Tasks;

namespace FundApproval.Api.Services.Reports
{
    /// <summary>
    /// Builds a professionally formatted PDF for a single Fund Request.
    /// Returns raw PDF bytes ready to stream or download.
    /// </summary>
    public interface IFundRequestPdfService
    {
        Task<byte[]> BuildAsync(int fundRequestId, CancellationToken ct = default);
    }
}
