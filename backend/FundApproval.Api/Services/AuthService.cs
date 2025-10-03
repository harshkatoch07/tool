using FundApproval.Api.Models;
using System.Security.Cryptography;
using System.Text;

namespace FundApproval.Api.Services
{
    public class AuthService
    {
        // Example for password hashing (not production grade)
        public string HashPassword(string password)
        {
            using var sha = SHA256.Create();
            var bytes = Encoding.UTF8.GetBytes(password);
            return Convert.ToBase64String(sha.ComputeHash(bytes));
        }

        public bool VerifyPassword(string hash, string password)
        {
            return hash == HashPassword(password);
        }
    }
}
