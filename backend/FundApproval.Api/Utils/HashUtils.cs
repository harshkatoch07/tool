namespace FundApproval.Api.Utils
{
    public static class HashUtil
    {
        public static string Hash(string input)
        {
            // Implement your hash logic, or use a placeholder:
            return BCrypt.Net.BCrypt.HashPassword(input);
        }
    }
}
