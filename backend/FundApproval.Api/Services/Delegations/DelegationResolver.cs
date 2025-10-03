// FILE: FundApproval.Api/Services/Delegations/DelegationResolver.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FundApproval.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FundApproval.Api.Services.Delegations
{
    public class DelegationResolver : IDelegationResolver
    {
        private readonly AppDbContext _db;

        public DelegationResolver(AppDbContext db)
        {
            _db = db;
        }

        public async Task<int> ResolveAssigneeAsync(int intendedUserId, CancellationToken ct)
        {
            // Resolve using UTC "now"
            var now = DateTime.UtcNow;

            var visited = new HashSet<int>();
            var current = intendedUserId;

            // Cap chain depth to prevent pathological loops
            const int maxHops = 5;
            for (var hop = 0; hop < maxHops; hop++)
            {
                if (!visited.Add(current))
                    return current; // loop detected – fall back to last known

                // Find most recent active delegation FROM current user
                var deleg = await _db.Delegations
                    .AsNoTracking()
                    .Where(d => d.FromUserId == current
                             && !d.IsRevoked
                             && d.StartsAtUtc <= now
                             && now < d.EndsAtUtc)
                    .OrderByDescending(d => d.CreatedAtUtc)
                    .FirstOrDefaultAsync(ct);

                if (deleg == null)
                    return current; // no active delegation – assign to current

                current = deleg.ToUserId; // follow the chain
            }

            return current; // safety return after maxHops
        }
    }
}
