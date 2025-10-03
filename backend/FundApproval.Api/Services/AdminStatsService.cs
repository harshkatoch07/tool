using FundApproval.Api.Data;
using FundApproval.Api.DTOs;
using Microsoft.EntityFrameworkCore;

namespace FundApproval.Api.Services
{
    public class AdminStatsService : IAdminStatsService
    {
        private readonly AppDbContext _db;
        public AdminStatsService(AppDbContext db) => _db = db;

        public async Task<IEnumerable<CountByDateDto>> GetActivityCountByDayAsync() =>
            await _db.AuditLogs
                .GroupBy(l => l.CreatedAt.Date) // ⬅️ FIX: use CreatedAt instead of Timestamp
                .Select(g => new CountByDateDto { Date = g.Key, Count = g.Count() })
                .ToListAsync();

        public async Task<IEnumerable<CountByStatusDto>> GetApprovalsByStatusAsync() =>
            await _db.Approvals
                .GroupBy(a => a.Status)
                .Select(g => new CountByStatusDto { Status = g.Key.ToString(), Count = g.Count() })
                .ToListAsync();
    }
}
