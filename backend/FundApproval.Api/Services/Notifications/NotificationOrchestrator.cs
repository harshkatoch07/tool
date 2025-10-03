using System.Threading;
using System.Threading.Tasks;
using FundApproval.Api.Data;
using FundApproval.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FundApproval.Api.Services.Notifications
{
    public sealed class NotificationOrchestrator : INotificationOrchestrator
    {
        private readonly AppDbContext _db;
        private readonly ILogger<NotificationOrchestrator> _logger;

        public NotificationOrchestrator(AppDbContext db, ILogger<NotificationOrchestrator> logger)
        {
            _db = db;
            _logger = logger;
        }

        private void Enqueue(string to, string subject, string html, string? cc = null)
        {
            if (string.IsNullOrWhiteSpace(to)) return;
            _db.EmailOutbox.Add(new EmailOutbox
            {
                ToAddress = to,
                Subject = subject,
                BodyHtml = html,
                Cc = cc
            });
        }

        public async Task OnInitiatedAsync(int fundRequestId, int initiatorUserId, int firstApproverUserId, CancellationToken ct)
        {
            var req = await _db.FundRequests
                .Include(r => r.Project)
                .FirstAsync(r => r.Id == fundRequestId, ct);

            var initiator = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == initiatorUserId, ct);
            if (!string.IsNullOrWhiteSpace(initiator?.Email))
                Enqueue(initiator.Email!, $"Request #{req.Id} submitted", EmailTemplates.InitiatorAck(req));

            var approver = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == firstApproverUserId, ct);
            if (!string.IsNullOrWhiteSpace(approver?.Email))
                Enqueue(approver.Email!, $"Approval required: Request #{req.Id}", EmailTemplates.ApproverAction(req, approver));
        }

        public async Task OnStepApprovedAsync(int fundRequestId, int initiatorUserId, int approvedStepSeq, int? nextApproverUserId, bool isFinal, CancellationToken ct)
        {
            var req = await _db.FundRequests
                .Include(r => r.Project)
                .FirstAsync(r => r.Id == fundRequestId, ct);

            if (isFinal)
            {
                var initiator = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == initiatorUserId, ct);
                if (!string.IsNullOrWhiteSpace(initiator?.Email))
                    Enqueue(initiator.Email!, $"Request #{req.Id} approved", EmailTemplates.FinalApproved(req));
            }
            else if (nextApproverUserId.HasValue)
            {
                var next = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == nextApproverUserId.Value, ct);
                if (!string.IsNullOrWhiteSpace(next?.Email))
                    Enqueue(next.Email!, $"Approval required: Request #{req.Id}", EmailTemplates.ApproverAction(req, next));
            }
        }

        public async Task OnRejectedAsync(int fundRequestId, int initiatorUserId, int rejectedStepSeq, int rejectedByUserId, string reason, CancellationToken ct)
        {
            var req = await _db.FundRequests
                .Include(r => r.Project)
                .FirstAsync(r => r.Id == fundRequestId, ct);

            var initiator = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == initiatorUserId, ct);
            if (!string.IsNullOrWhiteSpace(initiator?.Email))
                Enqueue(initiator.Email!, $"Request #{req.Id} rejected", EmailTemplates.Rejected(req, reason));
        }
    }
}
