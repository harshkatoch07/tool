using Microsoft.AspNetCore.Mvc;
using System.Collections.Concurrent;

namespace FundApproval.Api.Controllers
{
    [ApiController]
    [Route("api/logs")]
    public class LogController : ControllerBase
    {
        private static readonly ConcurrentQueue<string> _logs = new ConcurrentQueue<string>();

        // Call this from anywhere to add logs
        public static void AddLog(string message)
        {
            _logs.Enqueue($"[{DateTime.Now:HH:mm:ss}] {message}");
            if (_logs.Count > 1000) _logs.TryDequeue(out _); // Trim old logs
        }

        [HttpGet]
        public IActionResult GetLogs()
        {
            return Ok(_logs.ToArray());
        }
    }
}
