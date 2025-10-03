public class DelegationDto
{
    public int Id { get; set; }
    public int DelegateeId { get; set; }
    public string? DelegateeName { get; set; }
    public string? DelegateeEmail { get; set; }
    public DateTime Starts { get; set; }  // UTC
    public DateTime Ends { get; set; }    // UTC
    public string? Reason { get; set; }
}