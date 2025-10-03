// Services/Users/UserProjectQueries.cs
using FundApproval.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FundApproval.Api.Services.Users
{
    public static class UserProjectQueries
    {
        public static async Task<List<(int ProjectId, string ProjectName)>> GetAssignedProjectsByUserIdAsync(
            this AppDbContext db, int userId, IUserEmailResolver emails, CancellationToken ct = default)
        {
            var email = await emails.GetEmailByUserIdAsync(userId, ct);
            if (string.IsNullOrWhiteSpace(email)) return new();

            var norm = emails.Normalize(email);

            return await (from up in db.UserProjects.AsNoTracking()
                          join p in db.Projects.AsNoTracking() on up.ProjectId equals p.Id
                          where up.EmailID.Trim() == norm
                          orderby p.Name
                          select new ValueTuple<int, string>(p.Id, p.Name))
                         .ToListAsync(ct);
        }

        public static async Task<bool> HasProjectByUserIdAsync(
            this AppDbContext db, int userId, int projectId, IUserEmailResolver emails, CancellationToken ct = default)
        {
            var email = await emails.GetEmailByUserIdAsync(userId, ct);
            if (string.IsNullOrWhiteSpace(email)) return false;
            var norm = emails.Normalize(email);
            return await db.UserProjects.AsNoTracking()
                         .AnyAsync(up => up.ProjectId == projectId && up.EmailID.Trim() == norm, ct);
        }
    }
}
