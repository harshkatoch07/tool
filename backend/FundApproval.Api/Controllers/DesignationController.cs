using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FundApproval.Api.Services.Lookups;

namespace FundApproval.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DesignationsController : ControllerBase
    {
        private readonly IDesignationLookup _lookup;
        public DesignationsController(IDesignationLookup lookup) => _lookup = lookup;

        // GET /api/designations/{id}
        [HttpGet("{id:int}")]
        [Authorize]
        public async Task<IActionResult> GetById(int id)
        {
            var name = await _lookup.GetNameByIdAsync(id);
            if (string.IsNullOrWhiteSpace(name)) return NotFound();
            return Ok(new { id, name });
        }

        // GET /api/designations?query=man
        [HttpGet]
        [Authorize]
        public async Task<IActionResult> Search([FromQuery] string? query, [FromQuery] int top = 20)
        {
            var rows = await _lookup.SearchAsync(query, top);
            return Ok(rows.Select(r => new { id = r.Id, name = r.Name }));
        }
    }
}
