// FundApproval.Api/Models/Project.cs
using System;

namespace FundApproval.Api.Models
{
    /// <summary>
    /// Maps to dbo.Projects via AppDbContext:
    ///   Id          -> ProjectID (int, PK)
    ///   Name        -> ProjectName (nvarchar)
    ///   DepartmentID-> DepartmentID (int, nullable)
    ///   CreatedAt   -> CreatedAt (datetime, nullable)
    /// </summary>
    public class Project
    {
        public int Id { get; set; }                 // ProjectID
        public string Name { get; set; } = string.Empty; // ProjectName
        public int? DepartmentID { get; set; }      // nullable in DB
        public DateTime? CreatedAt { get; set; }    // nullable in DB

        // (No IsActive in dbo.Projects; AppDbContext ignores any IsActive property)
    }
}
