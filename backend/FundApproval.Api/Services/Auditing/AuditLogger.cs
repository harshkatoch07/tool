using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using FundApproval.Api.Data;
using FundApproval.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FundApproval.Api.Services.Auditing
{
    public class AuditLogger : IAuditLogger
    {
        private readonly AppDbContext _db;

        public AuditLogger(AppDbContext db)
        {
            _db = db;
        }

        // String-based overload (keeps existing call sites working)
        public async Task LogAsync(
            int fundRequestId,
            int? entityId,
            int actorUserId,
            string @event,
            string entity,
            object? details = null,
            CancellationToken ct = default)
        {
            string? comments = details switch
            {
                null => null,
                string s => s,
                _ => JsonSerializer.Serialize(details)
            };

            var actorName = await _db.Users
                .AsNoTracking()
                .Where(u => u.Id == actorUserId)
                .Select(u => u.FullName)
                .FirstOrDefaultAsync(ct);

            var log = new AuditLog
            {
                Event     = @event,
                Entity    = entity,
                EntityId  = entityId,
                ActorId   = actorUserId,
                ActorName = actorName,
                Comments  = comments,
                CreatedAt = DateTime.UtcNow
            };

            await _db.InsertAuditLogAsync(log, ct);
        }

        // Int-based overload (for places passing an int)
        public Task LogAsync(
            int fundRequestId,
            int? entityId,
            int actorUserId,
            int eventNumber,
            string entity,
            object? details = null,
            CancellationToken ct = default)
        {
            var eventName = $"Event#{eventNumber}";
            return LogAsync(fundRequestId, entityId, actorUserId, eventName, entity, details, ct);
        }
    }
}
