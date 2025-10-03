// FILE: FundApproval.Api/Controllers/AuthController.cs
using FundApproval.Api.Data;
using FundApproval.Api.Models;
using FundApproval.Api.Services.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Data.SqlClient;
using System.Data;

namespace FundApproval.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IJwtTokenService _jwt;
        private readonly IPasswordHasher _hasher;
        private readonly IMemoryCache _cache;
        private readonly ILogger<AuthController> _logger;

        private const int MaxAttempts = 5;
        private static readonly TimeSpan Window = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan Lockout = TimeSpan.FromMinutes(15);

        public AuthController(AppDbContext context, IJwtTokenService jwt, IPasswordHasher hasher, IMemoryCache cache, ILogger<AuthController> logger)
        {
            _context = context;
            _jwt = jwt;
            _hasher = hasher;
            _cache = cache;
            _logger = logger;
        }

        private static string AttemptsKey(string username) => $"login:attempts:{username?.ToLowerInvariant()}";
        private static string LockKey(string username) => $"login:lock:{username?.ToLowerInvariant()}";

        // Minimal row for login; maps to columns from Product_MST_UserSource
        private sealed class AuthRow
        {
            public int Id { get; set; }
            public string Username { get; set; } = "";
            public string? PasswordHash { get; set; } // maps to [Password] in the view
            public int Role { get; set; }
            public int? DepartmentId { get; set; }
            public int? ProjectId { get; set; }
            public string? FullName { get; set; }
            public string? Email { get; set; }
            public int? DesignationId { get; set; }
            public string? DesignationName { get; set; }
        }

        // Fast username lookup with 5s cap, EF minimal projection, raw ADO fallback, 5-min cache
        // Fast username lookup with tight cap, EF minimal projection, raw ADO fallback, 5-min cache
private async Task<AuthRow?> GetUserByUsernameFast(string username, CancellationToken ct)
{
    if (string.IsNullOrWhiteSpace(username)) return null;

    var cacheKey = $"auth:user:{username.ToLowerInvariant()}";
    if (_cache.TryGetValue(cacheKey, out AuthRow cached))
        return cached;

    bool efTimedOut = false;

    // 1) EF attempt (tight 4–5s cap, minimal projection)
    try
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct);
        linked.CancelAfter(TimeSpan.FromSeconds(4)); // a bit tighter so we fall back sooner

        var row = await _context.Users
            .AsNoTracking()
            .Where(u => u.Username == username)
            .Select(u => new AuthRow
            {
                Id = u.Id,
                Username = u.Username,
                PasswordHash = u.PasswordHash,   // entity has PasswordHash only
                Role = u.Role,                   // int
                DepartmentId = u.DepartmentId,
                ProjectId = u.ProjectId,
                FullName = u.FullName,
                Email = u.Email,
                DesignationId = u.DesignationId,
                DesignationName = u.DesignationName
            })
            .SingleOrDefaultAsync(linked.Token);

        if (row is not null)
        {
            _cache.Set(cacheKey, row, TimeSpan.FromMinutes(5));
            return row;
        }
    }
    catch (OperationCanceledException)
    {
        efTimedOut = true;
        _logger.LogWarning("EF login lookup timed out for {User} – using raw SQL fallback.", username);
    }
    catch (SqlException sqlEx) when (sqlEx.Number == -2 /* command timeout */ || sqlEx.Number == 1222 /* lock timeout */)
    {
        efTimedOut = true;
        _logger.LogWarning(sqlEx, "EF login lookup timeout/lock for {User} – using raw SQL fallback.", username);
    }
    catch (Exception ex)
    {
        // Treat “severe error / operation cancelled” as timeout for EF path
        if (ex.Message.Contains("Operation cancelled", StringComparison.OrdinalIgnoreCase) ||
            ex.Message.Contains("severe error occurred on the current command", StringComparison.OrdinalIgnoreCase))
        {
            efTimedOut = true;
            _logger.LogWarning(ex, "EF login lookup cancelled/severe for {User} – using raw SQL fallback.", username);
        }
        else
        {
            _logger.LogWarning(ex, "EF login lookup failed for {User} – using raw SQL fallback.", username);
        }
    }

    // 2) Raw SQL fallback (fail fast if blocked; 4s timeout)
    bool adoTimedOut = false;
    try
    {
        await using var conn = (SqlConnection)_context.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
SET DEADLOCK_PRIORITY LOW;
SET LOCK_TIMEOUT 2000;                    -- fail fast on blocking
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

SELECT TOP (1)
    p.[UserID]            AS Id,
    p.[Username]          AS Username,
    p.[Password]          AS PasswordHash,
    p.[RoleID]            AS Role,
    p.[DepartmentID]      AS DepartmentId,
    p.[ProjectID]         AS ProjectId,
    p.[FullName]          AS FullName,
    p.[EmailID]           AS Email,
    p.[DesignationId]     AS DesignationId,
    p.[DesignationName]   AS DesignationName
FROM [Product_MST_UserSource] AS p WITH (NOLOCK, INDEX(IX_Product_MST_UserSource_Username))
WHERE p.[Username] = @username
OPTION (RECOMPILE, OPTIMIZE FOR (@username UNKNOWN), FAST 1, MAXDOP 1);";
        cmd.CommandType = CommandType.Text;
        cmd.CommandTimeout = 4; // seconds

        var pUser = cmd.CreateParameter();
        pUser.ParameterName = "@username";
        pUser.DbType = DbType.String;
        pUser.Value = username;
        cmd.Parameters.Add(pUser);

        using var reader = await cmd.ExecuteReaderAsync(CommandBehavior.SingleRow, ct);
        if (await reader.ReadAsync(ct))
        {
            var row = new AuthRow
            {
                Id = reader.GetInt32(reader.GetOrdinal("Id")),
                Username = reader.GetString(reader.GetOrdinal("Username")),
                PasswordHash = reader.IsDBNull(reader.GetOrdinal("PasswordHash")) ? null : reader.GetString(reader.GetOrdinal("PasswordHash")),
                Role = reader.GetInt32(reader.GetOrdinal("Role")),
                DepartmentId = reader.IsDBNull(reader.GetOrdinal("DepartmentId")) ? null : reader.GetInt32(reader.GetOrdinal("DepartmentId")),
                ProjectId = reader.IsDBNull(reader.GetOrdinal("ProjectId")) ? null : reader.GetInt32(reader.GetOrdinal("ProjectId")),
                FullName = reader.IsDBNull(reader.GetOrdinal("FullName")) ? null : reader.GetString(reader.GetOrdinal("FullName")),
                Email = reader.IsDBNull(reader.GetOrdinal("Email")) ? null : reader.GetString(reader.GetOrdinal("Email")),
                DesignationId = reader.IsDBNull(reader.GetOrdinal("DesignationId")) ? null : reader.GetInt32(reader.GetOrdinal("DesignationId")),
                DesignationName = reader.IsDBNull(reader.GetOrdinal("DesignationName")) ? null : reader.GetString(reader.GetOrdinal("DesignationName"))
            };

            _cache.Set(cacheKey, row, TimeSpan.FromMinutes(5));
            return row;
        }
    }
    catch (SqlException ex) when (ex.Number == -2 /* command timeout */ || ex.Number == 1222 /* lock timeout */)
    {
        adoTimedOut = true;
        _logger.LogWarning(ex, "Raw SQL login lookup timed out/locked for {User}.", username);
    }
    catch (OperationCanceledException)
    {
        adoTimedOut = true;
        _logger.LogWarning("Raw SQL login lookup canceled for {User}.", username);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Raw SQL login lookup failed for {User}.", username);
    }

    // If BOTH attempts timed out/canceled/locked, surface as a 503 from the action
    if (efTimedOut && adoTimedOut)
        throw new TimeoutException("User lookup timed out on both EF and ADO paths.");

    return null;
}


        [AllowAnonymous]
[HttpPost("login")]
public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
{
    _logger.LogInformation("Login attempt for user: {Username}", request?.Username);

    if (string.IsNullOrWhiteSpace(request?.Username) || string.IsNullOrWhiteSpace(request?.Password))
        return BadRequest("Username and password are required.");

    var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    var attemptsKey = AttemptsKey(request.Username);
    var lockKey = LockKey(request.Username);

    if (_cache.TryGetValue<DateTime>(lockKey, out var lockedUntilUtc) && lockedUntilUtc > DateTime.UtcNow)
    {
        var secs = Math.Max(1, (int)(lockedUntilUtc - DateTime.UtcNow).TotalSeconds);
        _logger.LogWarning("Locked login attempt for {User} from {IP}. {Secs}s remaining.", request.Username, clientIp, secs);
        return StatusCode(423, $"Account locked. Try again in {secs} seconds.");
    }

    AuthRow? row;
    try
    {
        row = await GetUserByUsernameFast(request.Username, ct);
    }
    catch (TimeoutException tex)
    {
        _logger.LogError(tex, "Login lookup timed out for {User}.", request.Username);
        return StatusCode(503, new { message = "Authentication service is temporarily slow. Please retry." });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "DATABASE CONNECTION FAILED: Could not query user.");
        return StatusCode(500, new { message = "Database connection failed. Check server logs for details." });
    }

    if (row is null)
    {
        CountAttemptAndMaybeLock(attemptsKey, lockKey);
        _logger.LogWarning("User '{Username}' not found. IP: {IP}", request.Username, clientIp);
        await Task.Delay(Random.Shared.Next(80, 160), ct);
        return Unauthorized("Invalid username or password");
    }

    // password verify and hash upgrade (unchanged) ...
    bool isLegacy;
    if (!_hasher.TryVerify(request.Password, row.PasswordHash ?? "", out isLegacy))
    {
        CountAttemptAndMaybeLock(attemptsKey, lockKey);
        _logger.LogWarning("Invalid password for user '{Username}'. IP: {IP}", request.Username, clientIp);
        await Task.Delay(Random.Shared.Next(80, 160), ct);
        return Unauthorized("Invalid username or password");
    }

    if (isLegacy)
    {
        try
        {
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct);
            linked.CancelAfter(TimeSpan.FromSeconds(5));

            var upd = await _context.Users.FirstOrDefaultAsync(u => u.Id == row.Id, linked.Token);
            if (upd != null)
            {
                upd.PasswordHash = _hasher.Hash(request.Password);
                await _context.SaveChangesAsync(linked.Token);
                _logger.LogInformation("Upgraded password hash to BCrypt for user '{Username}'.", upd.Username);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upgrade password hash for user '{Username}'. Proceeding with login.", row.Username);
        }
    }

    _cache.Remove(attemptsKey);
    _cache.Remove(lockKey);

    var roleName = row.Role switch { 1 => "Admin", 2 => "User", _ => "User" };
    var token = _jwt.CreateAccessToken(row.Id, row.Username, roleName, row.Email);
    var expires = DateTime.UtcNow.AddMinutes(60);

    _logger.LogInformation("Login success: {User} as {Role} from {IP}", row.Username, roleName, clientIp);

    return Ok(new
    {
        token,
        user = new
        {
            id = row.Id,
            username = row.Username,
            fullName = row.FullName,
            designation = row.DesignationName,
            role = roleName
        },
        expiresAtUtc = expires
    });
}

        [HttpGet("ping-db")]
        public IActionResult PingDb()
        {
            try
            {
                var canConnect = _context.Database.CanConnect();
                return Ok(new { databaseConnection = canConnect ? "OK" : "Failed" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ping DB failed.");
                return StatusCode(500, "DB ping failed: " + ex.Message);
            }
        }

        private void CountAttemptAndMaybeLock(string attemptsKey, string lockKey)
        {
            var now = DateTime.UtcNow;
            var attempts = _cache.GetOrCreate<int>(attemptsKey, e =>
            {
                e.AbsoluteExpirationRelativeToNow = Window;
                return 0;
            });
            attempts++;
            _cache.Set(attemptsKey, attempts, Window);

            if (attempts >= MaxAttempts)
            {
                var until = now.Add(Lockout);
                _cache.Set(lockKey, until, Lockout);
            }
        }
    }

    public class LoginRequest
    {
        public string Username { get; set; } = "";
        public string Password { get; set; } = "";
    }
}
