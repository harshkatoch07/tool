using FundApproval.Api.DTOs;  // This is necessary to use CountByDateDto
namespace FundApproval.Api.DTOs
{
    public class CountByDateDto
    {
        public DateTime Date { get; set; }
        public int Count { get; set; }
    }
}
