// FILE: FundApproval.Api/Program.cs
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization; // for ReferenceHandler / JsonIgnoreCondition
using System.Threading.RateLimiting;
using System.Linq;

using FundApproval.Api.Data;
using FundApproval.Api.Middleware;
using FundApproval.Api.Services.Auditing;
using FundApproval.Api.Services.Approvals;
using FundApproval.Api.Services.Auth;
using FundApproval.Api.Config;
using FundApproval.Api.Services.Email;
using FundApproval.Api.Services.Notifications;
using FundApproval.Api.Services;  
using FundApproval.Api.Services.Delegations;             // ✅ ADDED (IReportService, ReportService)
using FundApproval.Api.Services.Users;
using QuestPDF.Infrastructure;
using Microsoft.Extensions.Configuration;

namespace FundApproval.Api
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);
            

            // Bind to predictable port for CRA proxy
            builder.WebHost.UseUrls("http://localhost:5292");

            // ---- Configuration ----
            builder.Configuration
                .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
                .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true)
                .AddEnvironmentVariables();

            // ---- Logging ----
            builder.Logging.ClearProviders();
            builder.Logging.AddConsole();
            builder.Logging.AddDebug();

            // ---- Cache ----
            builder.Services.AddMemoryCache();

            // ---- DbContext (fail fast if missing/empty connection string) ----
            var connStr = builder.Configuration.GetConnectionString("DefaultConnection");
            if (string.IsNullOrWhiteSpace(connStr))
            {
                var env = builder.Environment.EnvironmentName;
                Console.WriteLine("==== DB CONNECTION DIAGNOSTICS ====");
                Console.WriteLine($"ASPNETCORE_ENVIRONMENT: {env}");
                Console.WriteLine("ConnectionStrings:DefaultConnection is EMPTY or missing.");
                if (builder.Configuration is IConfigurationRoot root)
                {
                    foreach (var provider in root.Providers)
                        Console.WriteLine($" - {provider}");
                }
                Console.WriteLine("===================================");
                throw new InvalidOperationException("Missing ConnectionStrings:DefaultConnection.");
            }

            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseSqlServer(connStr, sql => { sql.EnableRetryOnFailure(5, TimeSpan.FromSeconds(2), null); }));

            // ---- CORS ----
            var corsOrigins = builder.Configuration.GetSection("CorsOrigins").Get<string[]>() ?? Array.Empty<string>();
            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowReactApp", policy =>
                {
                    policy.WithOrigins(corsOrigins)
                          .AllowAnyHeader()
                          .AllowAnyMethod()
                          .AllowCredentials();
                });
            });

            // ---- Controllers (+ global auth) ----
            builder.Services.AddControllers(options =>
            {
                var globalPolicy = new AuthorizationPolicyBuilder()
                    .RequireAuthenticatedUser()
                    .Build();
                options.Filters.Add(new AuthorizeFilter(globalPolicy));
            })
            .AddJsonOptions(o =>
            {
                o.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
                o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
                o.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
            });

            // ---- JWT ----
            var jwtSection = builder.Configuration.GetSection("JwtSettings");
            var secret   = jwtSection["SecretKey"];
            var issuer   = jwtSection["Issuer"];
            var audience = jwtSection["Audience"];

            if (string.IsNullOrWhiteSpace(secret))
                throw new InvalidOperationException("JWT secret is not configured (JwtSettings:SecretKey).");

            // ✅ Bind JwtSettings so IOptions<JwtSettings> resolves for JwtTokenService
            builder.Services.Configure<JwtSettings>(jwtSection);

            var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));

            builder.Services
                .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
                    options.SaveToken = true;
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        ValidIssuer = issuer,
                        ValidAudience = audience,
                        IssuerSigningKey = signingKey,
                        RoleClaimType = ClaimTypes.Role,
                        ClockSkew = TimeSpan.FromMinutes(2)
                    };
                });

            builder.Services.AddAuthorization(options =>
            {
                options.AddPolicy("AdminOnly", p => p.RequireRole("Admin"));
            });

            // ---- App services ----
            builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
            builder.Services.AddSingleton<IPasswordHasher, BcryptPasswordHasher>();
            
            builder.Services.AddScoped<IApproverResolver, ApproverResolver>();
            builder.Services.AddScoped<IReportService, ReportService>();
            builder.Services.AddHttpContextAccessor();
            builder.Services.AddScoped<IAuditLogger, AuditLogger>();
            builder.Services.AddScoped<FundApproval.Api.Services.Auditing.IAuditLogger, FundApproval.Api.Services.Auditing.AuditLogger>(); // ✅ ADDED

            // ---- Email / Notifications ----
            builder.Services.Configure<SmtpOptions>(builder.Configuration.GetSection("Smtp"));
            builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
            builder.Services.AddHostedService<EmailOutboxWorker>();
            builder.Services.AddScoped<INotificationOrchestrator, NotificationOrchestrator>();
            builder.Services.AddScoped<IFinalReceiverProvider, FinalReceiverProvider>();
            builder.Services.AddScoped<IDelegationResolver, DelegationResolver>();
            builder.Services.AddScoped<IUserEmailResolver, UserEmailResolver>();
            builder.Services.AddScoped<IFormSchemaBuilder, FormSchemaBuilder>();
            builder.Services.AddScoped<FundApproval.Api.Services.IFormSchemaBuilder, FundApproval.Api.Services.FormSchemaBuilder>();

            // ---- Rate limiting ----
            builder.Services.AddRateLimiter(options =>
            {
                options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpCtx =>
                {
                    var key = httpCtx.Connection.RemoteIpAddress?.ToString() ?? "global";
                    return RateLimitPartition.GetFixedWindowLimiter(
                        partitionKey: key,
                        factory: _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = 100,
                            Window = TimeSpan.FromMinutes(1),
                            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                            QueueLimit = 0
                        });
                });
                options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            });

            // ---- QuestPDF license ----
            QuestPDF.Settings.License = LicenseType.Community;

            var app = builder.Build();

            // Startup sanity: resolve once to fail fast if DI cannot create them
            using (var scope = app.Services.CreateScope())
            {
                _ = scope.ServiceProvider.GetRequiredService<INotificationOrchestrator>();
                _ = scope.ServiceProvider.GetRequiredService<IApproverResolver>();
                _ = scope.ServiceProvider.GetRequiredService<IReportService>();
                _ = scope.ServiceProvider.GetRequiredService<IFormSchemaBuilder>(); // ✅ ADDED
            }

            var prefix = secret.Length >= 5 ? secret[..5] : "(short)";
            app.Logger.LogInformation("ENV: {Env} | JWT secret prefix: {Prefix} | ConnStr set: {HasConn}",
                builder.Environment.EnvironmentName, prefix, !string.IsNullOrWhiteSpace(connStr));

            if (app.Environment.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }
            else
            {
                app.UseHttpsRedirection();
                app.UseHsts();
            }

            app.UseRouting();
            app.UseMiddleware<SecurityHeadersMiddleware>();
            app.UseCors("AllowReactApp");
            app.UseRateLimiter();
            app.UseAuthentication();
            app.UseAuthorization();

            // Public health endpoint
            app.MapGet("/api/health", () => Results.Ok(new { ok = true, at = DateTimeOffset.UtcNow }))
               .AllowAnonymous();

            app.MapControllers();

            app.Run();
        }
    }
}
  

