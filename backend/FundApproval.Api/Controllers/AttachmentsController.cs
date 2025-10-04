using System;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using FundApproval.Api.Data;
using FundApproval.Api.Models;

namespace FundApproval.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/fundrequests")]
    public class AttachmentsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<AttachmentsController> _logger;

        // Status constants (mirror ApprovalsController)
        private const string StatusPending   = "Pending";
        private const string StatusApproved  = "Approved";
        private const string StatusRejected  = "Rejected";
        private const string StatusSentBack  = "SentBack";

        public AttachmentsController(AppDbContext db, IWebHostEnvironment env, ILogger<AttachmentsController> logger)
        {
            _db = db;
            _env = env;
            _logger = logger;
        }

        // -----------------
        // Helpers
        // -----------------
        private int GetUserIdOrThrow()
        {
            var raw = User.FindFirstValue("UserId") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(raw, out var id) || id <= 0) throw new UnauthorizedAccessException("Invalid user.");
            return id;
        }

        private static bool CanInitiatorEdit(string status) =>
            string.Equals(status, StatusPending, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(status, StatusSentBack, StringComparison.OrdinalIgnoreCase);

        private string EnsureUploadDir(int fundRequestId)
        {
            // e.g. /{contentRoot}/uploads/fundrequests/123
            var root = Path.Combine(_env.ContentRootPath, "uploads", "fundrequests", fundRequestId.ToString());
            Directory.CreateDirectory(root);
            return root;
        }
        private string? ResolveAttachmentPath(Attachment attachment)
        {
            static string? NormalizeCandidate(string? value)
                => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

             var primary = NormalizeCandidate(attachment.StoragePath);
            if (!string.IsNullOrEmpty(primary))
            {
                if (Path.IsPathRooted(primary))
                    return primary;

                var trimmedPrimary = primary.TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
                return Path.Combine(_env.ContentRootPath, trimmedPrimary);
            }

            var legacy = NormalizeCandidate(attachment.LegacyFilePath);
            if (string.IsNullOrEmpty(legacy))
                return null;

            if (Path.IsPathRooted(legacy))
                return legacy;

            var trimmedLegacy = legacy.TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            return Path.Combine(_env.ContentRootPath, trimmedLegacy);
        }

        private void TryDeleteFile(string? path)
        {
            if (string.IsNullOrWhiteSpace(path))
                return;

            try
            {
                if (System.IO.File.Exists(path))
                    System.IO.File.Delete(path);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed deleting attachment file: {Path}", path);
            }
        }
        private async Task<bool> UserIsApproverAsync(int fundRequestId, int userId, CancellationToken ct)
        {
            return await _db.Approvals
                .AnyAsync(a => a.FundRequestId == fundRequestId && a.ApproverId == userId, ct);
        }

        // Unified Audit logger — matches dbo.AuditLogs schema
        private async Task WriteAuditAsync(string @event, string entity, int? entityId, int? actorId, string? comments, CancellationToken ct)
        {
            var log = new AuditLog
            {
                Event     = @event,
                Entity    = entity,
                EntityId  = entityId,
                ActorId   = actorId,
                ActorName = null,
                Comments  = comments,
                CreatedAt = DateTime.UtcNow
            };

            await _db.InsertAuditLogAsync(log, ct);
        }

        // -----------------
        // First-approver lock helpers
        // -----------------

        // Find the first approver DB level (skip Initiator and any FinalReceiver step)
        private async Task<int?> GetFirstApproverDbLevelAsync(int workflowId, CancellationToken ct)
        {
            // EF-safe: avoid StringComparison overloads. Treat Initiator as DesignationId == null/0.
            return await _db.WorkflowSteps
                .Where(ws => ws.WorkflowId == workflowId)
                .Where(ws => !(ws.IsFinalReceiver ?? false))
                .Where(ws => (ws.DesignationId ?? 0) != 0)
                .OrderBy(ws => ws.Sequence)
                .Select(ws => ws.Sequence) // int? (Sequence is nullable)
                .FirstOrDefaultAsync(ct);  // null if no approver step
        }

        // 🔒 Lock rule: once the FIRST approver has approved, attachments are locked (forever)
        private async Task<bool> IsLockedAfterFirstApprovalAsync(FundRequest fr, CancellationToken ct)
        {
            // Terminal states are always locked
            if (string.Equals(fr.Status, StatusApproved, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(fr.Status, StatusRejected, StringComparison.OrdinalIgnoreCase))
                return true;

            var firstLevel = await GetFirstApproverDbLevelAsync(fr.WorkflowId, ct);
            if (!(firstLevel.HasValue && firstLevel.Value > 0))
                return false; // no approver steps -> don't lock

            // Has the first approver already approved?
            var firstApproved = await _db.Approvals.AnyAsync(a =>
                a.FundRequestId == fr.Id &&
                a.Level == firstLevel.Value &&
                a.Status == StatusApproved, ct);

            return firstApproved;
        }

        // -----------------
        // Can the current user edit attachments for this FR?
        // GET: /api/fundrequests/{id}/attachments/can-edit
        // -----------------
        [HttpGet("{id:int}/attachments/can-edit")]
        public async Task<ActionResult<object>> CanEdit(int id, CancellationToken ct)
        {
            var me = GetUserIdOrThrow();
            var fr = await _db.FundRequests.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
            if (fr is null) return NotFound("Fund request not found.");

            var locked = await IsLockedAfterFirstApprovalAsync(fr, ct);
            var can = fr.InitiatorId == me && !locked && CanInitiatorEdit(fr.Status);

            return Ok(new
            {
                canEdit = can,
                locked,
                me,
                initiatorId = fr.InitiatorId,
                status = fr.Status
            });
        }

        // -----------------
        // List attachments (initiator or approver can read)
        // GET: /api/fundrequests/{id}/attachments
        // -----------------
        [HttpGet("{id:int}/attachments")]
        public async Task<ActionResult<IEnumerable<object>>> List(int id, CancellationToken ct)
        {
            var me = GetUserIdOrThrow();
            var fr = await _db.FundRequests.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
            if (fr is null) return NotFound("Fund request not found.");

            if (fr.InitiatorId != me && !await UserIsApproverAsync(id, me, ct))
                return Forbid();

            var items = await _db.Attachments
                .Where(a => a.FundRequestId == id)
                .OrderBy(a => a.Id)
                .Select(a => new {
                    a.Id, a.FileName, a.ContentType, SizeBytes = a.FileSize,
                    a.UploadedBy, a.UploadedAt
                }).ToListAsync(ct);

            return Ok(items);
        }

        // -----------------
        // Upload (Add)
        // POST: /api/fundrequests/{id}/attachments
        // form-data: file=<IFormFile>
        // -----------------
        [HttpPost("{id:int}/attachments")]
        [RequestSizeLimit(100_000_000)] // 100 MB
        public async Task<ActionResult<object>> Upload(int id, IFormFile? file, CancellationToken ct)
        {
            var me = GetUserIdOrThrow();
            var fr = await _db.FundRequests.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (fr is null) return NotFound("Fund request not found.");

            if (fr.InitiatorId != me) return Forbid();
            if (await IsLockedAfterFirstApprovalAsync(fr, ct))
                return Conflict("Attachments are locked after the first approver has approved.");
            if (!CanInitiatorEdit(fr.Status)) return Conflict("Attachments are locked for this request.");

            if (file == null || file.Length == 0) return BadRequest("Empty file.");

            var dir = EnsureUploadDir(id);
            var safeName = $"{Guid.NewGuid():N}_{Path.GetFileName(file.FileName)}";
            var fullPath = Path.Combine(dir, safeName);

            await using (var fs = System.IO.File.Create(fullPath))
            {
                await file.CopyToAsync(fs, ct);
            }

            var a = new Attachment
            {
                FundRequestId = id,
                FileName = file.FileName,
                ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
                FileSize = file.Length,
                StoragePath = fullPath,
                LegacyFilePath = fullPath,
                UploadedBy = me,
                UploadedAt = DateTime.UtcNow
            };

            _db.Attachments.Add(a);
            await _db.SaveChangesAsync(ct);

            await WriteAuditAsync(
                @event: "AttachmentAdded",
                entity: "Attachment",
                entityId: a.Id,
                actorId: me,
                comments: $"FR#{id} added '{a.FileName}' ({a.FileSize} bytes).",
                ct: ct
            );

            return Ok(new { a.Id, a.FileName, a.ContentType, SizeBytes = a.FileSize });
        }

        // -----------------
        // Replace
        // POST: /api/fundrequests/{id}/attachments/{attachmentId}/replace
        // -----------------
        [HttpPost("{id:int}/attachments/{attachmentId:int}/replace")]
        [RequestSizeLimit(100_000_000)]
        public async Task<ActionResult<object>> Replace(int id, int attachmentId, IFormFile? file, CancellationToken ct)
        {
            var me = GetUserIdOrThrow();
            var fr = await _db.FundRequests.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (fr is null) return NotFound("Fund request not found.");

            if (fr.InitiatorId != me) return Forbid();
            if (await IsLockedAfterFirstApprovalAsync(fr, ct))
                return Conflict("Attachments are locked after the first approver has approved.");
            if (!CanInitiatorEdit(fr.Status)) return Conflict("Attachments are locked for this request.");

            if (file == null || file.Length == 0) return BadRequest("Empty file.");

            var att = await _db.Attachments.FirstOrDefaultAsync(a => a.Id == attachmentId && a.FundRequestId == id, ct);
            if (att is null) return NotFound("Attachment not found.");

            var dir = EnsureUploadDir(id);
            var safeName = $"{Guid.NewGuid():N}_{Path.GetFileName(file.FileName)}";
            var fullPath = Path.Combine(dir, safeName);

            await using (var fs = System.IO.File.Create(fullPath))
            {
                await file.CopyToAsync(fs, ct);
            }

            var oldResolvedPath = ResolveAttachmentPath(att);

            att.FileName = file.FileName;
            att.ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType;
            att.FileSize = file.Length;
            att.StoragePath = fullPath;
            att.LegacyFilePath = fullPath;
            att.UploadedBy = me;
            att.UploadedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync(ct);

            // Try to remove old blob/file (best-effort)
TryDeleteFile(oldResolvedPath);

            await WriteAuditAsync(
                @event: "AttachmentReplaced",
                entity: "Attachment",
                entityId: att.Id,
                actorId: me,
                comments: $"FR#{id} replaced with '{att.FileName}' ({att.FileSize} bytes).",
                ct: ct
            );

            return Ok(new { att.Id, att.FileName, att.ContentType, SizeBytes = att.FileSize });
        }

        // -----------------
        // Delete
        // DELETE: /api/fundrequests/{id}/attachments/{attachmentId}
        // -----------------
        [HttpDelete("{id:int}/attachments/{attachmentId:int}")]
        public async Task<IActionResult> Delete(int id, int attachmentId, CancellationToken ct)
        {
            var me = GetUserIdOrThrow();
            var fr = await _db.FundRequests.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (fr is null) return NotFound("Fund request not found.");

            if (fr.InitiatorId != me) return Forbid();
            if (await IsLockedAfterFirstApprovalAsync(fr, ct))
                return Conflict("Attachments are locked after the first approver has approved.");
            if (!CanInitiatorEdit(fr.Status)) return Conflict("Attachments are locked for this request.");

            var att = await _db.Attachments.FirstOrDefaultAsync(a => a.Id == attachmentId && a.FundRequestId == id, ct);
            if (att is null) return NotFound("Attachment not found.");
            var resolvedPath = ResolveAttachmentPath(att);

            _db.Attachments.Remove(att);
            await _db.SaveChangesAsync(ct);

TryDeleteFile(resolvedPath);

            await WriteAuditAsync(
                @event: "AttachmentDeleted",
                entity: "Attachment",
                entityId: attachmentId,
                actorId: me,
                comments: $"FR#{id} deleted '{att.FileName}'.",
                ct: ct
            );

            return NoContent();
        }

        // -----------------
        // Download (initiator or approver)
        // GET: /api/fundrequests/{id}/attachments/{attachmentId}/download?inline=true|false
        // -----------------
        [HttpGet("{id:int}/attachments/{attachmentId:int}/download")]
        public async Task<IActionResult> Download(int id, int attachmentId, [FromQuery] bool inline = false, CancellationToken ct = default)
        {
            var me = GetUserIdOrThrow();
            var fr = await _db.FundRequests.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
            if (fr is null) return NotFound("Fund request not found.");

            if (fr.InitiatorId != me && !await UserIsApproverAsync(id, me, ct))
                return Forbid();

            var a = await _db.Attachments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == attachmentId && x.FundRequestId == id, ct);
            if (a is null) return NotFound("Attachment not found.");

            var resolvedPath = ResolveAttachmentPath(a);

            if (string.IsNullOrWhiteSpace(resolvedPath) || !System.IO.File.Exists(resolvedPath))
                return NotFound("File missing on server.");

            // 🔎 View log
            var ip = HttpContext?.Connection?.RemoteIpAddress?.ToString();
            await WriteAuditAsync(
                @event: "AttachmentViewed",
                entity: "Attachment",
                entityId: a.Id,
                actorId: me,
                comments: $"FR#{id} viewed '{a.FileName}' (inline={inline}, ip={ip ?? "n/a"}).",
                ct: ct
            );

           var stream = System.IO.File.OpenRead(resolvedPath);
            var contentType = string.IsNullOrWhiteSpace(a.ContentType) ? "application/octet-stream" : a.ContentType;

            if (inline)
            {
                Response.Headers.ContentDisposition = $"inline; filename=\"{a.FileName}\"";
                return File(stream, contentType);
            }

            return File(stream, contentType, fileDownloadName: a.FileName);
        }
    }
}
