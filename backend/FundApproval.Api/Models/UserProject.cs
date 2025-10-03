// FILE: FundApproval.Api/Models/UserProject.cs
namespace FundApproval.Api.Models
{
    public class UserProject
    {
        public int ProjectId { get; set; }
        public string EmailID { get; set; } = string.Empty;

        // optional nav
        public Project? Project { get; set; }
    }
}
