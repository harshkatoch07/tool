using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

[Table("Product_MST_Department")]
public class Department
{
    [Key]
    [Column("DepartmentID")]
    public int DepartmentID { get; set; }

    [Column("Name")]
    public string? Name { get; set; } // <-- varchar

    [Column("ShortName")]
    public string? ShortName { get; set; } // <-- varchar

    [Column("DepartmentHead")]
    public int? DepartmentHead { get; set; } // <-- int

    [Column("IsActive")]
    public bool IsActive { get; set; } // <-- bit
}


