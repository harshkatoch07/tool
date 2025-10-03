// FILE: FundApproval.Api/Middleware/SecurityHeadersMiddleware.cs
using Microsoft.AspNetCore.Http;

namespace FundApproval.Api.Middleware
{
    public sealed class SecurityHeadersMiddleware
    {
        private readonly RequestDelegate _next;

        public SecurityHeadersMiddleware(RequestDelegate next) => _next = next;

        public async Task Invoke(HttpContext context)
        {
            var headers = context.Response.Headers;
            headers["X-Content-Type-Options"] = "nosniff";
            headers["X-Frame-Options"] = "DENY";
            headers["Referrer-Policy"] = "no-referrer";
            headers["X-XSS-Protection"] = "0";
            headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=(), payment=()";

            // Adjust CSP in development if needed
            headers["Content-Security-Policy"] =
                "default-src 'self'; " +
                "img-src 'self' data: blob:; " +
                "font-src 'self' data:; " +
                "style-src 'self' 'unsafe-inline'; " + // allow MUI inline styles
                "script-src 'self'; " +
                "connect-src 'self' http://localhost:3000 http://localhost:3001; " +
                "frame-ancestors 'none'";

            await _next(context);
        }
    }
}
