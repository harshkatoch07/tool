// FILE: FundApproval.Api/Services/Auth/JwtTokenService.cs
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace FundApproval.Api.Services.Auth
{
    // Bind this from configuration in Program.cs
    public class JwtSettings
    {
        public string SecretKey { get; set; } = "";
        public string Issuer { get; set; } = "";
        public string Audience { get; set; } = "";
        public int AccessTokenMinutes { get; set; } = 60;
    }

    public interface IJwtTokenService
    {
        // Include optional email so downstream endpoints can join on EmailID
        string CreateAccessToken(int userId, string userName, string role, string? email = null);
    }

    public sealed class JwtTokenService : IJwtTokenService
    {
        private readonly JwtSettings _s;
        private readonly byte[] _key;

        public JwtTokenService(IOptions<JwtSettings> s)
        {
            _s = s.Value;

            if (string.IsNullOrWhiteSpace(_s.SecretKey))
                throw new ArgumentException("JwtSettings.SecretKey is empty. Check appsettings or environment overrides.");

            // HS256 requires >= 32 bytes of entropy
            if (Encoding.UTF8.GetByteCount(_s.SecretKey) < 32)
                throw new ArgumentException("JwtSettings.SecretKey is too short for HS256. Use a long random secret (>= 32 bytes).");

            _key = Encoding.UTF8.GetBytes(_s.SecretKey);
        }

        public string CreateAccessToken(int userId, string userName, string role, string? email = null)
        {
            userName ??= $"user-{userId}";
            role = string.IsNullOrWhiteSpace(role) ? "User" : role;

            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, userId.ToString()),
                new(ClaimTypes.NameIdentifier, userId.ToString()),
                new(ClaimTypes.Name, userName),
                new(ClaimTypes.Role, role),
            };

            // Add email claims if provided
            if (!string.IsNullOrWhiteSpace(email))
            {
                email = email.Trim();
                claims.Add(new(ClaimTypes.Email, email));
                claims.Add(new("email", email));
                // Common extras some clients/providers expect:
                claims.Add(new("preferred_username", email));
            }

            var creds = new SigningCredentials(new SymmetricSecurityKey(_key), SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _s.Issuer,
                audience: _s.Audience,
                claims: claims,
                notBefore: DateTime.UtcNow,
                expires: DateTime.UtcNow.AddMinutes(_s.AccessTokenMinutes <= 0 ? 60 : _s.AccessTokenMinutes),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
