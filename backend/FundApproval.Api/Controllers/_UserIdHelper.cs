using System.Security.Claims;

namespace FundApproval.Api.Controllers
{
    internal static class UserIdHelper
    {
        public static bool TryGetUserId(this ClaimsPrincipal user, out int userId)
        {
            userId = 0;
            var raw = user.FindFirstValue("UserId")
                   ?? user.FindFirstValue(ClaimTypes.NameIdentifier)
                   ?? user.FindFirstValue("uid")
                   ?? user.FindFirstValue("sub");
            return int.TryParse(raw, out userId);
        }
    }
}
