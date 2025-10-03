using BCrypt.Net;

namespace FundApproval.Api.Services.Auth
{
    public interface IPasswordHasher
    {
        string Hash(string password);
        bool TryVerify(string password, string stored, out bool isLegacy);
    }

    public sealed class BcryptPasswordHasher : IPasswordHasher
    {
        public string Hash(string password) =>
            BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12);

        // ✔️ Verifies BCrypt hashes; flags legacy/plaintext (non-$2*) without throwing
        public bool TryVerify(string password, string stored, out bool isLegacy)
        {
            isLegacy = false;
            if (string.IsNullOrWhiteSpace(stored)) return false;

            // BCrypt hashes start with $2a$, $2b$, or $2y$
            if (stored.StartsWith("$2a$") || stored.StartsWith("$2b$") || stored.StartsWith("$2y$"))
            {
                try
                {
                    return BCrypt.Net.BCrypt.Verify(password, stored);
                }
                catch
                {
                    return false;
                }
            }

            // Not a BCrypt hash → treat as legacy/plaintext
            isLegacy = true;
            return string.Equals(password, stored, StringComparison.Ordinal);
        }
    }
}
    