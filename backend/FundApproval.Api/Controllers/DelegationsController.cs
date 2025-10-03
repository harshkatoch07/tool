using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using FundApproval.Api.Data;
using FundApproval.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FundApproval.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DelegationsController : ControllerBase
    {
        private readonly AppDbContext _db;
        public DelegationsController(AppDbContext db) => _db = db;

        private int GetUserIdOrThrow()
        {
            // Try common claim names for numeric user id
            var candidates = new[]
            {
                "uid",
                ClaimTypes.NameIdentifier,
                "sub",
                "UserID",
                "userid",
                "user_id"
            };

            foreach (var key in candidates)
            {
                var val = User.FindFirstValue(key);
                if (!string.IsNullOrWhiteSpace(val) && int.TryParse(val, out var id))
                    return id;
            }

            throw new UnauthorizedAccessException("Numeric user id claim not found.");
        }

        /// <summary>
        /// List delegations the current user (owner) has created for others.
        /// </summary>
        [HttpGet("my")]
        public async Task<IActionResult> GetMyDelegations()
        {
            var me = GetUserIdOrThrow();

            var query =
                from d in _db.Delegations.AsNoTracking()
                join u in _db.Users.AsNoTracking() on d.ToUserId equals u.Id
                where d.FromUserId == me
                orderby d.StartsAtUtc descending
                select new
                {
                    id = d.Id,
                    delegateeId = d.ToUserId,
                    delegateeName = u.FullName,
                    delegateeEmail = u.Email,
                    starts = d.StartsAtUtc,  // UTC
                    ends = d.EndsAtUtc,      // UTC
                    reason = (string?)null   // add mapping if/when you add a Reason column
                };

            var list = await query.ToListAsync();
            return Ok(list);
        }

        /// <summary>
        /// Create a new delegation (expects UTC timestamps).
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateDelegationDto body)
        {
            var me = GetUserIdOrThrow();

            if (body.DelegateeId <= 0)
                return BadRequest("DelegateeId is required.");

            if (body.Ends <= body.Starts)
                return BadRequest("Ends must be after Starts.");

            if ((body.Ends - body.Starts).TotalDays > 30.0001)
                return BadRequest("Max duration is 30 days.");

            if (body.DelegateeId == me)
                return BadRequest("You cannot delegate to yourself.");

            var entity = new Delegation
            {
                FromUserId  = me,
                ToUserId    = body.DelegateeId,
                StartsAtUtc = DateTime.SpecifyKind(body.Starts, DateTimeKind.Utc),
                EndsAtUtc   = DateTime.SpecifyKind(body.Ends,   DateTimeKind.Utc),
                IsRevoked   = false
                // add Reason here if the table has a column
            };

            _db.Delegations.Add(entity);
            await _db.SaveChangesAsync();

            var delegatee = await _db.Users.AsNoTracking()
                                 .Where(u => u.Id == entity.ToUserId)
                                 .Select(u => new { u.FullName, u.Email })
                                 .FirstOrDefaultAsync();

            return CreatedAtAction(nameof(GetMyDelegations), new { id = entity.Id }, new
            {
                id = entity.Id,
                delegateeId = entity.ToUserId,
                delegateeName = delegatee?.FullName,
                delegateeEmail = delegatee?.Email,
                starts = entity.StartsAtUtc,
                ends = entity.EndsAtUtc,
                reason = body.Reason
            });
        }

        /// <summary>
        /// Delete a delegation you created.
        /// </summary>
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var me = GetUserIdOrThrow();

            var d = await _db.Delegations.FirstOrDefaultAsync(x => x.Id == id);
            if (d == null) return NotFound();
            if (d.FromUserId != me) return Forbid();

            _db.Delegations.Remove(d); // if you prefer soft-delete: d.IsRevoked = true;
            await _db.SaveChangesAsync();

            return NoContent();
        }
    }

    // Keep the DTO in the same file to avoid missing-reference issues.
    public class CreateDelegationDto
    {
        public int DelegateeId { get; set; }
        public DateTime Starts { get; set; } // UTC
        public DateTime Ends { get; set; }   // UTC
        public string? Reason { get; set; }
    }
}
