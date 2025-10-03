using System;

namespace FundApproval.Api.Models
{
    public class Delegation
    {
        public int Id { get; set; }

        // FKs + navs (match AppDbContext fluent mapping)
        public int FromUserId { get; set; }
        public User FromUser  { get; set; } = null!;

        public int ToUserId { get; set; }
        public User ToUser   { get; set; } = null!;

        public DateTime StartsAtUtc  { get; set; }
        public DateTime EndsAtUtc    { get; set; }
        public DateTime CreatedAtUtc { get; set; }
        public bool IsRevoked        { get; set; }
    }
}
