// FILE: Services/Reports/QuestPdfFundRequestService.cs
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FundApproval.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace FundApproval.Api.Services.Reports
{
    // NOTE: Do NOT redeclare IFundRequestPdfService here; it already exists elsewhere.
    // This class implements that interface.

    public sealed class QuestPdfFundRequestService : IFundRequestPdfService
    {
        // ✅ Safety net: ensure QuestPDF license is set before any document generation
        static QuestPdfFundRequestService()
        {
            if (QuestPDF.Settings.License != LicenseType.Community &&
                QuestPDF.Settings.License != LicenseType.Professional)
            {
                QuestPDF.Settings.License = LicenseType.Community;
            }
        }

        private readonly AppDbContext _db;
        private readonly ILogger<QuestPdfFundRequestService> _logger;

        public QuestPdfFundRequestService(AppDbContext db, ILogger<QuestPdfFundRequestService> logger)
        {
            _db = db;
            _logger = logger;
        }

        // ========= Fonts =========
        private static bool _fontsReady = false;

        /// <summary>
        /// Configure a base font. By default, use a Standard 14 PDF font (Helvetica).
        /// Optionally embed a Unicode TTF (e.g., Noto Sans) to avoid any '?' glyphs.
        /// </summary>
        private void EnsureFonts()
        {
            if (_fontsReady) return;

            try
            {
                // Default: Standard font
                TextStyle.Default.FontFamily("Helvetica");
                TextStyle.Default.FontSize(10);

                // OPTIONAL: Embed a Unicode font (place TTF files in: FundApproval.Api/Fonts)
                // var baseDir = AppContext.BaseDirectory;
                // var regularPath = Path.Combine(baseDir, "Fonts", "NotoSans-Regular.ttf");
                // var boldPath    = Path.Combine(baseDir, "Fonts", "NotoSans-Bold.ttf");
                // if (File.Exists(regularPath))
                //     FontManager.RegisterFont(File.OpenRead(regularPath));
                // if (File.Exists(boldPath))
                //     FontManager.RegisterFont(File.OpenRead(boldPath));
                // TextStyle.Default.FontFamily("Noto Sans");

                _fontsReady = true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Font registration failed. Falling back to Helvetica.");
                TextStyle.Default.FontFamily("Helvetica");
                TextStyle.Default.FontSize(10);
                _fontsReady = true;
            }
        }

        // ========= Interface =========
        public async Task<byte[]> BuildAsync(int fundRequestId, CancellationToken ct = default)
        {
            EnsureFonts();

            // Load the full fund request with related data
            var fr = await _db.FundRequests
                .Include(f => f.Fields)
                .Include(f => f.Attachments)
                .Include(f => f.Approvals)
                .FirstOrDefaultAsync(f => f.Id == fundRequestId, ct);

            if (fr == null)
                throw new KeyNotFoundException($"Fund request {fundRequestId} not found.");

            var deptName = await _db.Departments
                .Where(d => d.DepartmentID == fr.DepartmentId)
                .Select(d => d.Name)
                .FirstOrDefaultAsync(ct);

            var projectName = await _db.Projects
                .Where(p => p.Id == fr.ProjectId)
                .Select(p => p.Name)
                .FirstOrDefaultAsync(ct);

            var initiator = await _db.Users
                .Where(u => u.Id == fr.InitiatorId)
                .Select(u => new { u.FullName, u.Email })
                .FirstOrDefaultAsync(ct);

            // Approver name map
            var approverIds = fr.Approvals.Select(a => a.ApproverId).Distinct().ToList();
            var userMap = await _db.Users
                .Where(u => approverIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FullName })
                .ToDictionaryAsync(x => x.Id, x => x.FullName, ct);

            var trail = fr.Approvals
                .OrderBy(a => a.Level)
                .ThenBy(a => a.ActionedAt ?? DateTime.MinValue)
                .Select(a => new TrailVm
                {
                    Level = a.Level,
                    ApproverName = userMap.TryGetValue(a.ApproverId, out var nm) ? nm : $"User #{a.ApproverId}",
                    Status = a.Status ?? "Pending",
                    ActionedAt = a.ActionedAt,
                    Comments = a.Comments
                })
                .ToList();

            // Add Final Receivers as a terminal level (if missing)
            var finalReceiverIds = await _db.WorkflowFinalReceivers
                .Where(r => r.WorkflowId == fr.WorkflowId)
                .Select(r => r.UserId)
                .Distinct()
                .ToListAsync(ct);

            if (finalReceiverIds.Count > 0)
            {
                var frUserMap = await _db.Users
                    .Where(u => finalReceiverIds.Contains(u.Id))
                    .Select(u => new { u.Id, u.FullName })
                    .ToDictionaryAsync(x => x.Id, x => x.FullName, ct);

                int finalLevel = Math.Max(fr.CurrentLevel + 1, (trail.LastOrDefault()?.Level ?? 0) + 1);

                foreach (var uid in finalReceiverIds)
                {
                    var name = frUserMap.TryGetValue(uid, out var nm) ? nm : $"User #{uid}";
                    bool exists = trail.Any(t => t.Level == finalLevel && t.ApproverName == name);
                    if (!exists)
                    {
                        trail.Add(new TrailVm
                        {
                            Level = finalLevel,
                            ApproverName = name,
                            Status = fr.Status == "Approved" ? "FinalReceiver" : "Upcoming",
                            ActionedAt = null,
                            Comments = null
                        });
                    }
                }

                trail = trail.OrderBy(t => t.Level).ThenBy(t => t.ActionedAt ?? DateTime.MinValue).ToList();
            }

            // Create the PDF
            var model = new SummaryVm
            {
                Id = fr.Id,
                Title = fr.RequestTitle ?? "",
                Description = fr.Description,
                Amount = (fr.Amount ?? 0m),
                Status = fr.Status ?? "Pending",
                CreatedAt = fr.CreatedAt,
                Department = deptName,
                Project = projectName,
                InitiatorName = initiator?.FullName ?? "Unknown",
                InitiatorEmail = initiator?.Email,
                Fields = fr.Fields
                    .OrderBy(f => f.Id)
                    .Select(f => new Kv(f.FieldName, f.FieldValue))
                    .ToList(),
                Attachments = fr.Attachments
                    .OrderBy(a => a.Id)
                    .Select(a => new AttachmentVm(a.FileName, a.ContentType, a.FileSize))
                    .ToList(),
                Trail = trail
            };

            // ✅ Generate with explicit license ensure + single retry on license exception
            return GenerateWithLicense(model);
        }

        // ========= License & generation wrappers =========

        private static void EnsureLicense()
        {
            if (QuestPDF.Settings.License != LicenseType.Community &&
                QuestPDF.Settings.License != LicenseType.Professional)
            {
                QuestPDF.Settings.License = LicenseType.Community;
            }
        }

        private static byte[] GenerateWithLicense(SummaryVm s)
        {
            // ensure immediately before any document creation
            EnsureLicense();

            try
            {
                return BuildDocumentInternal(s);
            }
            catch (Exception ex) when (ex.Message?.IndexOf("QuestPDF", StringComparison.OrdinalIgnoreCase) >= 0
                                     && ex.Message?.IndexOf("license", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                // Last-chance: set again and retry once
                QuestPDF.Settings.License = LicenseType.Community;
                return BuildDocumentInternal(s);
            }
        }

        // ========= Layout helpers =========

        // NOTE: this is your original BuildDocument body moved here
        private static byte[] BuildDocumentInternal(SummaryVm s)
        {
            var primary = Colors.Blue.Medium;
            var subtle = Colors.Grey.Medium;
            var headerStyle = TextStyle.Default.FontSize(16).Bold().FontColor(primary);
            var labelStyle = TextStyle.Default.SemiBold().FontColor(Colors.Grey.Darken2);

            var doc = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(32);
                    page.DefaultTextStyle(TextStyle.Default.FontSize(10));
                    page.PageColor(Colors.White);

                    // Header
                    page.Header().Element(c =>
                    {
                        c.Column(col =>
                        {
                            col.Spacing(6);

                            col.Item().Row(r =>
                            {
                                r.RelativeItem().Text($"Fund Request #{s.Id}: {s.Title}").Style(headerStyle);
                                r.ConstantItem(160).AlignRight().Text(t =>
                                {
                                    t.Span("Amount: ").SemiBold();
                                    t.Span(Money2(s.Amount));
                                });
                            });

                            col.Item().Row(r =>
                            {
                                r.RelativeItem().Text(t =>
                                {
                                    t.Span("Status: ").SemiBold().FontColor(subtle);
                                    t.Span(StatusLabel(s.Status));
                                });

                                r.ConstantItem(220).AlignRight().Text(t =>
                                {
                                    t.Span("Created: ").SemiBold().FontColor(subtle);
                                    t.Span(s.CreatedAt.ToString("yyyy-MM-dd HH:mm"));
                                });
                            });

                            // Separator line
                            col.Item().Height(1).Background(Colors.Grey.Lighten2);
                        });
                    });

                    // Content
                    page.Content().Element(c =>
                    {
                        c.Column(col =>
                        {
                            col.Spacing(12);

                            // Meta grid
                            col.Item().Element(meta =>
                            {
                                meta.Table(t =>
                                {
                                    t.ColumnsDefinition(cols =>
                                    {
                                        cols.RelativeColumn(1); // label
                                        cols.RelativeColumn(2); // value
                                        cols.RelativeColumn(1);
                                        cols.RelativeColumn(2);
                                    });

                                    // Row 1
                                    AddMetaRow(t, "Department", s.Department);
                                    AddMetaRow(t, "Project", s.Project);

                                    // Row 2
                                    AddMetaRow(t, "Initiator", s.InitiatorName);
                                    AddMetaRow(t, "Email", s.InitiatorEmail);

                                    // Row 3
                                    AddMetaRow(t, "Status", StatusLabel(s.Status));
                                    AddMetaRow(t, "Amount", Money2(s.Amount));
                                });
                            });

                            // Description
                            if (!string.IsNullOrWhiteSpace(s.Description))
                            {
                                col.Item().Text("Description").Style(headerStyle).FontSize(13);
                                col.Item().Text(s.Description).FontColor(Colors.Grey.Darken1);
                            }

                            // Form Data
                            col.Item().Text("Form Data").Style(headerStyle).FontSize(13);
                            col.Item().Element(e => RenderKeyValueTable(e, s.Fields));

                            // Attachments
                            col.Item().Text("Attachments").Style(headerStyle).FontSize(13);
                            col.Item().Element(e => RenderAttachmentsTable(e, s.Attachments));

                            // Trail
                            col.Item().Text("Approval Trail").Style(headerStyle).FontSize(13);
                            col.Item().Element(e => RenderTrailTable(e, s.Trail));
                        });
                    });

                    // Footer
                    page.Footer().AlignRight().Text(x =>
                    {
                        x.Span("Generated ").FontColor(Colors.Grey.Darken1).FontSize(9);
                        x.Span(DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm 'UTC'")).FontColor(Colors.Grey.Darken1).FontSize(9);
                    });
                });
            });

            return doc.GeneratePdf();
        }

        private static void AddMetaRow(TableDescriptor t, string key, string? val)
        {
            var labelStyle = TextStyle.Default.SemiBold().FontColor(Colors.Grey.Darken2);

            t.Cell().PaddingVertical(3).Text(key).Style(labelStyle);
            t.Cell().PaddingVertical(3).Text(Show(val));
            t.Cell().PaddingVertical(3).Text(""); // keep grid symmetric
            t.Cell().PaddingVertical(3).Text("");
        }

        private static void RenderKeyValueTable(IContainer container, List<Kv> items)
        {
            container.Table(t =>
            {
                t.ColumnsDefinition(c =>
                {
                    c.RelativeColumn(1);
                    c.RelativeColumn(2);
                });

                // Header
                t.Header(h =>
                {
                    h.Cell().Background(Colors.Grey.Lighten3).Padding(6).Text("Field").SemiBold();
                    h.Cell().Background(Colors.Grey.Lighten3).Padding(6).Text("Value").SemiBold();
                });

                if (items == null || items.Count == 0)
                {
                    t.Cell().ColumnSpan(2).Padding(6).Text("—");
                    return;
                }

                foreach (var kv in items)
                {
                    t.Cell().Padding(6).Text(Show(kv.Name));
                    t.Cell().Padding(6).Text(Show(kv.Value));
                }
            });
        }

        private static void RenderAttachmentsTable(IContainer container, List<AttachmentVm> items)
        {
            container.Table(t =>
            {
                t.ColumnsDefinition(c =>
                {
                    c.RelativeColumn(3); // file
                    c.RelativeColumn(2); // type
                    c.RelativeColumn(1); // size
                });

                t.Header(h =>
                {
                    h.Cell().Background(Colors.Grey.Lighten3).Padding(6).Text("File").SemiBold();
                    h.Cell().Background(Colors.Grey.Lighten3).Padding(6).Text("Type").SemiBold();
                    h.Cell().Background(Colors.Grey.Lighten3).Padding(6).AlignRight().Text("Size").SemiBold();
                });

                if (items == null || items.Count == 0)
                {
                    t.Cell().ColumnSpan(3).Padding(6).Text("—");
                    return;
                }

                foreach (var a in items)
                {
                    t.Cell().Padding(6).Text(Show(a.FileName));
                    t.Cell().Padding(6).Text(Show(a.ContentType));
                    t.Cell().Padding(6).AlignRight().Text(FormatBytes(a.Size));
                }
            });
        }

        private static void RenderTrailTable(IContainer container, List<TrailVm> rows)
        {
            container.Table(t =>
            {
                t.ColumnsDefinition(c =>
                {
                    c.ConstantColumn(40); // Level
                    c.RelativeColumn(3);  // Approver
                    c.RelativeColumn(2);  // Status
                    c.RelativeColumn(2);  // Actioned
                    c.RelativeColumn(4);  // Comments
                });

                t.Header(h =>
                {
                    h.Cell().Background(Colors.Grey.Lighten3).Padding(6).Text("Lvl").SemiBold();
                    h.Cell().Background(Colors.Grey.Lighten3).Padding(6).Text("Approver").SemiBold();
                    h.Cell().Background(Colors.Grey.Lighten3).Padding(6).Text("Status").SemiBold();
                    h.Cell().Background(Colors.Grey.Lighten3).Padding(6).Text("Actioned At").SemiBold();
                    h.Cell().Background(Colors.Grey.Lighten3).Padding(6).Text("Comments").SemiBold();
                });

                if (rows == null || rows.Count == 0)
                {
                    t.Cell().ColumnSpan(5).Padding(6).Text("—");
                    return;
                }

                foreach (var r in rows)
                {
                    t.Cell().Padding(6).Text(r.Level.ToString());
                    t.Cell().Padding(6).Text(Show(r.ApproverName));
                    t.Cell().Padding(6).Text(StatusLabel(r.Status));
                    t.Cell().Padding(6).Text(r.ActionedAt.HasValue ? r.ActionedAt.Value.ToString("yyyy-MM-dd HH:mm") : "—");
                    t.Cell().Padding(6).Text(Show(r.Comments));
                }
            });
        }

        // ========= Small helpers / VMs =========

        private static string Show(string? s) => string.IsNullOrWhiteSpace(s) ? "—" : s;

        private static string StatusLabel(string? s) =>
            string.Equals(s, "FinalReceiver", StringComparison.OrdinalIgnoreCase) ? "Final Receiver"
            : string.IsNullOrWhiteSpace(s) ? "—"
            : s!;

        private static string Money2(decimal amount) => amount.ToString("N2");

        private static string FormatBytes(long n)
        {
            if (n >= 1_000_000_000) return $"{n / 1_000_000_000.0:0.0} GB";
            if (n >= 1_000_000) return $"{n / 1_000_000.0:0.0} MB";
            if (n >= 1_000) return $"{n / 1_000.0:0.0} KB";
            return $"{n} B";
        }

        private sealed class SummaryVm
        {
            public int Id { get; set; }
            public string Title { get; set; } = "";
            public string? Description { get; set; }
            public decimal Amount { get; set; }
            public string Status { get; set; } = "";
            public DateTime CreatedAt { get; set; }
            public string? Department { get; set; }
            public string? Project { get; set; }
            public string InitiatorName { get; set; } = "";
            public string? InitiatorEmail { get; set; }
            public List<Kv> Fields { get; set; } = new();
            public List<AttachmentVm> Attachments { get; set; } = new();
            public List<TrailVm> Trail { get; set; } = new();
        }

        private readonly record struct Kv(string Name, string? Value);
        private readonly record struct AttachmentVm(string FileName, string ContentType, long Size);

        private sealed class TrailVm
        {
            public int Level { get; set; }
            public string ApproverName { get; set; } = "";
            public string Status { get; set; } = "";
            public DateTime? ActionedAt { get; set; }
            public string? Comments { get; set; }
        }
    }
}
