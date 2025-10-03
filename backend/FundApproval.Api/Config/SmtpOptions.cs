namespace FundApproval.Api.Config
{
    public sealed class SmtpOptions
    {
        public string Host { get; set; } = "";
        public int Port { get; set; } = 587;
        public bool UseSsl { get; set; } = true;
        public string Username { get; set; } = "";
        public string Password { get; set; } = "";
        public string FromAddress { get; set; } = "no-reply@Gera.in";
        public string FromName { get; set; } = "Approval";
    }
}
