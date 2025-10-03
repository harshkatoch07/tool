using System.Collections.Generic;
using System.Threading.Tasks;
using FundApproval.Api.DTOs; // If your DTOs are here

namespace FundApproval.Api.Services
{
    public interface IAdminStatsService
    {
        Task<IEnumerable<CountByDateDto>> GetActivityCountByDayAsync();
        Task<IEnumerable<CountByStatusDto>> GetApprovalsByStatusAsync();
    }
}
