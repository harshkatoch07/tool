namespace FundApproval.Api.Services.Email
{
    public interface IEmailSender
    {
        Task SendAsync(string to, string subject, string htmlBody, string? cc = null, CancellationToken ct = default);
    }
}
