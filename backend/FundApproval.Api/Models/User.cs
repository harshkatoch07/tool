// Models/User.cs
namespace FundApproval.Api.Models
{
    public class User
    {
        public int Id { get; set; }
        public string? Username { get; set; }
        public string? FullName { get; set; }
        public string? Email { get; set; }
        public int? DesignationId { get; set; }
        public string? DesignationName { get; set; }
        public string? PasswordHash { get; set; }
        public int? DepartmentId { get; set; }
        public int? ProjectId { get; set; }
        public string? Mobile { get; set; }
        public string? Gender { get; set; }
        public int Role { get; set; }

        // 🔹 NEW: map this to your table column (IsActive OR IsActiveFlag)
        public bool? IsActive { get; set; }

        // NAVS if you use them for delegations
        public ICollection<Delegation> DelegationsFrom { get; set; } = new List<Delegation>();
        public ICollection<Delegation> DelegationsTo   { get; set; } = new List<Delegation>();
    }
}
