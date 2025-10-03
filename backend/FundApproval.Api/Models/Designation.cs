// FILE: Models/Designation.cs
namespace FundApproval.Api.Models
{
    public class Designation
    {
        public int Id { get; set; }                 // DesignationID
        public string Name { get; set; } = default!; // DesignationName

        public int DepartmentId { get; set; }       // DepartmentID (seems non-null in DB)
        public int? AtLevel { get; set; }           // NULL-able in DB
        public int? NoticePeriod { get; set; }      // NULL-able in DB
        public int? SalaryGrade { get; set; }       // NULL-able in DB
        public bool IsActive { get; set; }

        // convenience (if you keep it)
        public string? DesignationName { get; set; }
    }
}
