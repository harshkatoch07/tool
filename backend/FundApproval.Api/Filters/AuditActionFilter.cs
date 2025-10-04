// FILE: FundApproval.Api/Filters/AuditActionFilter.cs
using System.Security.Claims;
using FundApproval.Api.Data;
using FundApproval.Api.Models;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Logging;

namespace FundApproval.Api.Filters
{
    public sealed class AuditActionFilter : IAsyncActionFilter
    {
        private readonly AppDbContext _db;
        private readonly ILogger<AuditActionFilter> _logger;

        public AuditActionFilter(AppDbContext db, ILogger<AuditActionFilter> logger)
        {
            _db = db;
            _logger = logger;
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var executed = await next();

            // only log successful 2xx results and swallow errors
            if (executed.Exception != null) return;
            var status = (executed.Result as Microsoft.AspNetCore.Mvc.ObjectResult)?.StatusCode ?? 200;
            if (status < 200 || status >= 300) return;

            var desc       = context.ActionDescriptor as ControllerActionDescriptor;
            var controller = desc?.ControllerName ?? "UnknownController";
            var action     = desc?.ActionName ?? "UnknownAction";

            // User info
            var userIdStr = context.HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                            ?? context.HttpContext.User.FindFirstValue("UserId");
            int? actorId = int.TryParse(userIdStr, out var uid) ? uid : (int?)null;
            var actorName = context.HttpContext.User.Identity?.Name;

            var log = new AuditLog
            {
                Event     = $"{controller}.{action}",
                Entity    = controller,
                EntityId  = null,                 // set if you have a specific entity id
                ActorId   = actorId,
                ActorName = actorName,
                Comments  = null,
                CreatedAt = DateTime.UtcNow
            };

            try
            {
                _await _db.InsertAuditLogAsync(log, context.HttpContext.RequestAborted);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to write audit log for {Controller}.{Action}", controller, action);
            }
        }
    }
}
    