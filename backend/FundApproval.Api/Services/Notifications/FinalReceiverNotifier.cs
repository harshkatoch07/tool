// FILE: FundApproval.Api/Services/Notifications/FinalReceiverNotifier.cs
using FundApproval.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FundApproval.Api.Services.Notifications
{
    public interface IFinalReceiverNotifier
    {
        Task NotifyApprovedAsync(int requestId, CancellationToken ct = default);
    }

    public class FinalReceiverNotifier : IFinalReceiverNotifier
    {
        private readonly AppDbContext _db;
        private readonly ILogger<FinalReceiverNotifier> _logger;

        public FinalReceiverNotifier(AppDbContext db, ILogger<FinalReceiverNotifier> logger)
        {
            _db = db;
            _logger = logger;
        }

        public async Task NotifyApprovedAsync(int requestId, CancellationToken ct = default)
        {
            var req = await _db.FundRequests
                .AsNoTracking()
                .Include(r => r.Workflow)
                    .ThenInclude(w => w.FinalReceivers)
                .FirstOrDefaultAsync(r => r.Id == requestId, ct);

            if (req == null || req.Status != "Approved") return;

            foreach (var fr in req.Workflow.FinalReceivers)
            {
                // TODO: push an in-app notification/email/etc. to fr.UserId
                _logger.LogInformation("Notify FinalReceiver UserId={UserId} for Approved RequestId={RequestId}", fr.UserId, requestId);
            }
        }
    }
}
