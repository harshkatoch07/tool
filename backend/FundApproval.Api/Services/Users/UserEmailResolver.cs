// Services/Users/UserEmailResolver.cs
using FundApproval.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FundApproval.Api.Services.Users
{
    public interface IUserEmailResolver
    {
        Task<string?> GetEmailByUserIdAsync(int userId, CancellationToken ct = default);
        string Normalize(string? email);
    }

    public sealed class UserEmailResolver : IUserEmailResolver
    {
        private readonly AppDbContext _db;
        public UserEmailResolver(AppDbContext db) => _db = db;

        public async Task<string?> GetEmailByUserIdAsync(int userId, CancellationToken ct = default) =>
            await _db.Users.AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => u.Email)
                .FirstOrDefaultAsync(ct);

        public string Normalize(string? email) => (email ?? string.Empty).Trim().ToLowerInvariant();
    }
}
