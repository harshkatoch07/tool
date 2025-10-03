// FILE: FundApproval.Api/Services/Email/SmtpEmailSender.cs
using System.Net;
using System.Net.Mail;
using System.Net.Sockets;
using System.Security.Authentication;
using System.Text;
using FundApproval.Api.Config;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FundApproval.Api.Services.Email
{
    public sealed class SmtpEmailSender : IEmailSender
    {
        private readonly SmtpOptions _opt;
        private readonly ILogger<SmtpEmailSender> _logger;

        public SmtpEmailSender(IOptions<SmtpOptions> opt, ILogger<SmtpEmailSender> logger)
        {
            _opt = opt.Value;
            _logger = logger;
        }

        public async Task SendAsync(string to, string subject, string htmlBody, string? cc = null, CancellationToken ct = default)
        {
            // Defensive: trim host, basic validation
            var host = (_opt.Host ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(host))
                throw new InvalidOperationException("SMTP Host is not configured.");
            if (_opt.Port <= 0)
                throw new InvalidOperationException("SMTP Port must be > 0.");
            if (string.IsNullOrWhiteSpace(_opt.FromAddress))
                throw new InvalidOperationException("SMTP FromAddress is not configured.");

            using var msg = new MailMessage
            {
                From = new MailAddress(_opt.FromAddress, string.IsNullOrWhiteSpace(_opt.FromName) ? _opt.FromAddress : _opt.FromName),
                Subject = subject ?? string.Empty,
                Body = htmlBody ?? string.Empty,
                IsBodyHtml = true
            };

            msg.To.Add(to);
            if (!string.IsNullOrWhiteSpace(cc)) msg.CC.Add(cc);

            using var client = new SmtpClient(host, _opt.Port)
            {
                EnableSsl = _opt.UseSsl,                 // STARTTLS for Office 365 on 587
                DeliveryMethod = SmtpDeliveryMethod.Network,
                UseDefaultCredentials = false,
                Credentials = new NetworkCredential(_opt.Username, _opt.Password),
                Timeout = 1000 * 30
            };

            _logger.LogInformation("SMTP: connecting Host={Host} Port={Port} SSL={Ssl} From={From} To={To}",
                host, _opt.Port, _opt.UseSsl, _opt.FromAddress, to);

            try
            {
                await client.SendMailAsync(msg, ct);
                _logger.LogInformation("SMTP: email sent successfully to {To} (subject: {Subject})", to, subject);
            }
            catch (SmtpException ex)
            {
                // Rich details for O365 auth/permission errors
                var detail = BuildError(
                    "SMTP send failed",
                    new Dictionary<string, string?>
                    {
                        ["Host"] = host,
                        ["Port"] = _opt.Port.ToString(),
                        ["SSL"] = _opt.UseSsl.ToString(),
                        ["From"] = _opt.FromAddress,
                        ["To"] = to,
                        ["SmtpStatusCode"] = ex.StatusCode.ToString()
                    },
                    ex);

                _logger.LogError(ex, "{Detail}", detail);
                throw new InvalidOperationException(detail, ex);
            }
            catch (AuthenticationException ex)
            {
                var detail = BuildError(
                    "TLS/SSL handshake failed with SMTP server",
                    new Dictionary<string, string?>
                    {
                        ["Host"] = host,
                        ["Port"] = _opt.Port.ToString(),
                        ["SSL"] = _opt.UseSsl.ToString()
                    },
                    ex);

                _logger.LogError(ex, "{Detail}", detail);
                throw new InvalidOperationException(detail, ex);
            }
            catch (SocketException ex)
            {
                var detail = BuildError(
                    "Network error connecting to SMTP server",
                    new Dictionary<string, string?>
                    {
                        ["Host"] = host,
                        ["Port"] = _opt.Port.ToString()
                    },
                    ex);

                _logger.LogError(ex, "{Detail}", detail);
                throw new InvalidOperationException(detail, ex);
            }
            catch (Exception ex)
            {
                var detail = BuildError(
                    "Unexpected error sending email",
                    new Dictionary<string, string?>
                    {
                        ["Host"] = host,
                        ["Port"] = _opt.Port.ToString(),
                        ["To"] = to
                    },
                    ex);

                _logger.LogError(ex, "{Detail}", detail);
                throw new InvalidOperationException(detail, ex);
            }
        }

        private static string BuildError(string title, IDictionary<string, string?> ctx, Exception ex)
        {
            var sb = new StringBuilder();
            sb.Append(title);

            if (ctx.Any())
            {
                sb.Append(" [");
                sb.Append(string.Join(", ", ctx.Select(kv => $"{kv.Key}={kv.Value}")));
                sb.Append("]");
            }

            // Flatten exception + inners for EmailOutbox.LastError
            sb.Append(": ").Append(ex.Message);
            var ie = ex.InnerException;
            var depth = 0;
            while (ie is not null && depth < 4) // limit depth to avoid huge strings
            {
                sb.Append(" | Inner: ").Append(ie.GetType().Name).Append(": ").Append(ie.Message);
                ie = ie.InnerException;
                depth++;
            }

            return sb.ToString();
        }
    }
}
