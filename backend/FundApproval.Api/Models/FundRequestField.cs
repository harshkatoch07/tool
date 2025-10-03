using System.ComponentModel.DataAnnotations.Schema;

namespace FundApproval.Api.Models
{
    public class FundRequestField
    {
        public int Id { get; set; }
        public int FundRequestId { get; set; }
        public string FieldName { get; set; }
        public string FieldValue { get; set; }

        public FundRequest FundRequest { get; set; }
    }
}