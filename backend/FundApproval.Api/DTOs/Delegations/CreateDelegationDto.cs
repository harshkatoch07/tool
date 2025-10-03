using System;

namespace FundApproval.Api.DTOs.Delegations
{
    public class CreateDelegationDto
    {
        public int DelegateeId { get; set; }
        public DateTime Starts { get; set; } // UTC
        public DateTime Ends { get; set; }   // UTC
        public string? Reason { get; set; }
    }
}
