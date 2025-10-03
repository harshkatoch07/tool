using System.ComponentModel.DataAnnotations.Schema;

namespace FundApproval.Api.Models
{
    [Table("Product_MST_CAPEA")] // Table name in DB
    public class Product_MST_CAPEA
    {
        [Column("ProjectID")]
        public int Id { get; set; }

        [Column("ProjectName")]
        public string Name { get; set; }
    }
}
