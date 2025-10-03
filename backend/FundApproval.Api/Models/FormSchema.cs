namespace FundApproval.Api.Models
{
    public class FormSchema
    {
        public int Id { get; set; }
        public string Department { get; set; } = string.Empty;       // can store department id as string or name
        public string DepartmentName { get; set; } = string.Empty;   // canonical department name
        public string Project { get; set; } = string.Empty;
        public string SchemaJson { get; set; } = string.Empty;
        public bool IsActive { get; set; }
    }
}
