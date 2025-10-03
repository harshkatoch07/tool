using FundApproval.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FundApproval.Api.Services.Email
{
    public sealed class EmailOutboxWorker : BackgroundService
    {
        private readonly IServiceProvider _sp;
        private readonly ILogger<EmailOutboxWorker> _logger;
        public EmailOutboxWorker(IServiceProvider sp, ILogger<EmailOutboxWorker> logger) { _sp = sp; _logger = logger; }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _sp.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var sender = scope.ServiceProvider.GetRequiredService<IEmailSender>();

                    var batch = await db.EmailOutbox
                        .Where(e => e.SentUtc == null && e.Attempts < 5)
                        .OrderBy(e => e.Id)
                        .Take(20)
                        .ToListAsync(stoppingToken);

                    foreach (var item in batch)
                    {
                        try
                        {
                            await sender.SendAsync(item.ToAddress, item.Subject, item.BodyHtml, item.Cc, stoppingToken);
                            item.SentUtc = DateTime.UtcNow;
                            item.LastError = null;
                        }
                        catch (Exception ex)
                        {
                            item.Attempts += 1;
                            item.LastError = ex.Message;
                            _logger.LogWarning(ex, "Email outbox send failed for {Id}", item.Id);
                        }
                    }
                    await db.SaveChangesAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "EmailOutboxWorker loop error");
                }
                await Task.Delay(TimeSpan.FromSeconds(8), stoppingToken);
            }
        }
    }
}
