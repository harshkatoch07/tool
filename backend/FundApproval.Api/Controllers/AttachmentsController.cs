using System;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
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

        private const string StatusPending  = "Pending";
        private const string StatusApproved = "Approved";
        private const string StatusRejected = "Rejected";
        private const string StatusSentBack = "SentBack";

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
            var root = Path.Combine(_env.ContentRootPath, "uploads", "fundrequests", fundRequestId.ToString());
            Directory.CreateDirectory(root);
            return root;
        }

        // FIX 1: Resolve relative or absolute paths
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

            return ResolveLegacyLocation(attachment);
        }

           private string? ResolveLegacyLocation(Attachment attachment)
        {
            try
            {
                var fileName = Path.GetFileName(attachment.FileName);
                if (string.IsNullOrWhiteSpace(fileName))
                    return null;

                var legacyDirectory = Path.Combine(
                    _env.ContentRootPath,
                    "uploads",
                    "fundrequests",
                    attachment.FundRequestId.ToString());

                if (!Directory.Exists(legacyDirectory))
                    return null;

                var exactPath = Path.Combine(legacyDirectory, fileName);
                if (System.IO.File.Exists(exactPath))
                    return exactPath;

                foreach (var candidate in Directory.EnumerateFiles(legacyDirectory))
                {
                    var candidateName = Path.GetFileName(candidate);
                    if (string.Equals(candidateName, fileName, StringComparison.OrdinalIgnoreCase))
                        return candidate;

                    if (candidateName.EndsWith("_" + fileName, StringComparison.OrdinalIgnoreCase))
                        return candidate;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to resolve legacy attachment path for attachment {AttachmentId}", attachment.Id);
            }
            return null;
        }

        private void TryDeleteFile(string? path)
        {
            if (string.IsNullOrWhiteSpace(path)) return;

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
        private async Task<int?> GetFirstApproverDbLevelAsync(int workflowId, CancellationToken ct)
        {
            return await _db.WorkflowSteps
                .Where(ws => ws.WorkflowId == workflowId)
                .Where(ws => !(ws.IsFinalReceiver ?? false))
                .Where(ws => (ws.DesignationId ?? 0) != 0)
                .OrderBy(ws => ws.Sequence)
                .Select(ws => ws.Sequence)
                .FirstOrDefaultAsync(ct);
        }

        private async Task<bool> IsLockedAfterFirstApprovalAsync(FundRequest fr, CancellationToken ct)
        {
            if (string.Equals(fr.Status, StatusApproved, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(fr.Status, StatusRejected, StringComparison.OrdinalIgnoreCase))
                return true;

            var firstLevel = await GetFirstApproverDbLevelAsync(fr.WorkflowId, ct);
            if (!(firstLevel.HasValue && firstLevel.Value > 0))
                return false;

            var firstApproved = await _db.Approvals.AnyAsync(a =>
                a.FundRequestId == fr.Id &&
                a.Level == firstLevel.Value &&
                a.Status == StatusApproved, ct);

            return firstApproved;
        }

        // -----------------
        // Can the current user edit attachments for this FR?
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
        // -----------------
        [HttpGet("{id:int}/attachments")]
public async Task<ActionResult<IEnumerable<object>>> List(int id, CancellationToken ct)
{
    try
    {
        var me = GetUserIdOrThrow();
        var fr = await _db.FundRequests.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (fr is null) return NotFound("Fund request not found.");

        if (fr.InitiatorId != me && !await UserIsApproverAsync(id, me, ct))
            return Forbid();

        var items = await _db.Attachments
            .Where(a => a.FundRequestId == id)
            .OrderBy(a => a.Id)
            .ToListAsync(ct);

        // ✅ FIX: Build URLs safely with null checking
        var result = items.Select(a => 
        {
            var downloadUrl = "";
            try
            {
                downloadUrl = Url.Action("Download", "Attachments", 
                    new { id, attachmentId = a.Id }, 
                    Request.Scheme) ?? $"/api/fundrequests/{id}/attachments/{a.Id}/download";
            }
            catch
            {
                downloadUrl = $"/api/fundrequests/{id}/attachments/{a.Id}/download";
            }

            return new
            {
                Id = a.Id,
                FileName = a.FileName ?? "",
                ContentType = a.ContentType ?? "application/octet-stream",
                SizeBytes = a.FileSize,
                UploadedBy = a.UploadedBy,
                UploadedAt = a.UploadedAt,
                Url = downloadUrl
            };
        }).ToList();

        return Ok(result);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Failed to list attachments for FundRequest {FundRequestId}", id);
        return StatusCode(500, new { error = "Failed to load attachments", detail = ex.Message });
    }
}

        // -----------------
        // Upload (Add)
        // -----------------
        [HttpPost("{id:int}/attachments")]
        [RequestSizeLimit(100_000_000)]
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

            // FIX 2: store RELATIVE path
            var relativePath = Path.Combine("uploads", "fundrequests", id.ToString(), safeName);

            var a = new Attachment
            {
                FundRequestId = id,
                FileName = file.FileName,
                ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
                FileSize = file.Length,
                StoragePath = relativePath,
                
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

            var downloadUrl = Url.Action("Download", "Attachments", new { id, attachmentId = a.Id }, Request.Scheme);

            return Ok(new { a.Id, a.FileName, a.ContentType, SizeBytes = a.FileSize, Url = downloadUrl });
        }

        // -----------------
        // Replace
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

            // FIX 3: keep RELATIVE path
            var relativePath = Path.Combine("uploads", "fundrequests", id.ToString(), safeName);

            att.FileName = file.FileName;
            att.ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType;
            att.FileSize = file.Length;
            att.StoragePath = relativePath;
            
            att.UploadedBy = me;
            att.UploadedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync(ct);

            TryDeleteFile(oldResolvedPath);

            await WriteAuditAsync(
                @event: "AttachmentReplaced",
                entity: "Attachment",
                entityId: att.Id,
                actorId: me,
                comments: $"FR#{id} replaced with '{att.FileName}' ({att.FileSize} bytes).",
                ct: ct
            );

            var downloadUrl = Url.Action("Download", "Attachments", new { id, attachmentId = att.Id }, Request.Scheme);
            return Ok(new { att.Id, att.FileName, att.ContentType, SizeBytes = att.FileSize, Url = downloadUrl });
        }

        // -----------------
        // Delete
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

            // FIX 5: diagnostic logging
            _logger.LogInformation("Attachment {AttachmentId}: StoragePath={StoragePath}, ResolvedPath={ResolvedPath}",
                a.Id, a.StoragePath, resolvedPath);

            if (string.IsNullOrWhiteSpace(resolvedPath) || !System.IO.File.Exists(resolvedPath))
            {
                _logger.LogWarning("File not found: {Path}", resolvedPath);
                return NotFound("File missing on server.");
            }

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
