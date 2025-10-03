using FundApproval.Api.Data;
using FundApproval.Api.Models;
using System;
using System.Threading.Tasks;

namespace FundApproval.Api.Services
{
    public class ApprovalService
    {
        private readonly AppDbContext _db;
        public ApprovalService(AppDbContext db) => _db = db;

        public async Task AdvanceApprovalAsync(FundRequest request)
        {
            // Example: Advance approval to next level or finish
            var nextLevel = request.CurrentLevel + 1;
            // Fetch next approver based on org logic
            // If nextLevel > max, set request.Status = "Approved"
            // Else, create new Approval record for next approver
        }
    }
}
