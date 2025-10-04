using System;
using System.IO;
using System.Net;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using FundApproval.Api.Controllers;
using FundApproval.Api.Data;
using FundApproval.Api.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace FundApproval.Api.Tests
{
    public class AttachmentsControllerTests
    {
        private const int InitiatorId = 123;

        private sealed class TempDirectory : IDisposable
        {
            public TempDirectory()
            {
                DirectoryPath = Path.Combine(Path.GetTempPath(), $"fundapproval-tests-{Guid.NewGuid():N}");
                Directory.CreateDirectory(DirectoryPath);
            }

            public string DirectoryPath { get; }

            public void Dispose()
            {
                try
                {
                    if (Directory.Exists(DirectoryPath))
                    {
                        Directory.Delete(DirectoryPath, recursive: true);
                    }
                }
                catch
                {
                    // Ignore IO cleanup errors for tests
                }
            }
        }

        private sealed class TestWebHostEnvironment : IWebHostEnvironment
        {
            public TestWebHostEnvironment(string contentRoot)
            {
                ContentRootPath = contentRoot;
            }

            public string ApplicationName { get; set; } = "FundApproval.Tests";
            public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
            public string ContentRootPath { get; set; }
            public string EnvironmentName { get; set; } = "Test";
            public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
            public string? WebRootPath { get; set; }
        }

        private static DbContextOptions<AppDbContext> CreateOptions(SqliteConnection connection)
        {
            return new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite(connection)
                .Options;
        }

        private static async Task SeedFundRequestAsync(AppDbContext db)
        {
            db.Departments.Add(new Department
            {
                DepartmentID = 1,
                Name = "Finance"
            });

            db.Workflows.Add(new Workflow
            {
                WorkflowId = 1,
                Name = "Default",
                DepartmentId = 1
            });

            db.FundRequests.Add(new FundRequest
            {
                Id = 1,
                RequestTitle = "Test",
                InitiatorId = InitiatorId,
                WorkflowId = 1,
                DepartmentId = 1,
                Status = "Pending",
                Amount = 100m
            });

            await db.SaveChangesAsync();
        }

        private AttachmentsController CreateController(AppDbContext db, string contentRoot)
        {
            var env = new TestWebHostEnvironment(contentRoot);
            var controller = new AttachmentsController(db, env, NullLogger<AttachmentsController>.Instance)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext
                    {
                        User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("UserId", InitiatorId.ToString()) }, "Test")),
                        RequestServices = new ServiceCollection().BuildServiceProvider()
                    }
                }
            };

            controller.ControllerContext.HttpContext.Connection.RemoteIpAddress = IPAddress.Loopback;
            return controller;
        }
        [Fact]
        public void AttachmentModel_MapsLegacyPropertyToFilePathColumn()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite("DataSource=:memory:")
                .Options;

            using var context = new AppDbContext(options);
            var entity = context.Model.FindEntityType(typeof(Attachment));
            Assert.NotNull(entity);

            var property = entity!.FindProperty(nameof(Attachment.LegacyFilePath));
            Assert.NotNull(property);

            var identifier = StoreObjectIdentifier.Table("Attachments");
            var columnName = property!.GetColumnName(identifier);
            Assert.Equal("FilePath", columnName);
        }
        [Fact]
        public async Task Download_UsesStoragePath_WhenAvailable()
        {
            await using var connection = new SqliteConnection("DataSource=:memory:");
            await connection.OpenAsync();
            var options = CreateOptions(connection);

            using var tempDir = new TempDirectory();

            await using (var setupContext = new AppDbContext(options))
            {
                await setupContext.Database.EnsureCreatedAsync();
                await SeedFundRequestAsync(setupContext);

                var filePath = Path.Combine(tempDir.DirectoryPath, "storage.txt");
                await File.WriteAllTextAsync(filePath, "storage-file");

                var fileInfo = new FileInfo(filePath);

                setupContext.Attachments.Add(new Attachment
                {
                    Id = 1,
                    FundRequestId = 1,
                    FileName = "storage.txt",
                    ContentType = "text/plain",
                    FileSize = fileInfo.Length,
                    StoragePath = filePath,
                    LegacyFilePath = null,
                    UploadedBy = InitiatorId,
                    UploadedAt = DateTime.UtcNow
                });

                await setupContext.SaveChangesAsync();
            }

            await using (var assertionContext = new AppDbContext(options))
            {
                var controller = CreateController(assertionContext, tempDir.DirectoryPath);

                var result = await controller.Download(1, 1, inline: false, ct: CancellationToken.None);
                var fileResult = Assert.IsType<FileStreamResult>(result);

                using var reader = new StreamReader(fileResult.FileStream);
                var text = await reader.ReadToEndAsync();
                Assert.Equal("storage-file", text);
            }
        }

        [Fact]
        public async Task Download_FallsBackToLegacyFilePath_WhenStorageMissing()
        {
            await using var connection = new SqliteConnection("DataSource=:memory:");
            await connection.OpenAsync();
            var options = CreateOptions(connection);

            using var tempDir = new TempDirectory();

            await using (var setupContext = new AppDbContext(options))
            {
                await setupContext.Database.EnsureCreatedAsync();
                await SeedFundRequestAsync(setupContext);

                var legacyDir = Path.Combine(tempDir.DirectoryPath, "legacy");
                Directory.CreateDirectory(legacyDir);
                var legacyFile = Path.Combine(legacyDir, "legacy.txt");
                await File.WriteAllTextAsync(legacyFile, "legacy-file");

                var legacyInfo = new FileInfo(legacyFile);

                setupContext.Attachments.Add(new Attachment
                {
                    Id = 2,
                    FundRequestId = 1,
                    FileName = "legacy.txt",
                    ContentType = "text/plain",
                    FileSize = legacyInfo.Length,
                    StoragePath = string.Empty,
                    LegacyFilePath = Path.Combine("legacy", "legacy.txt"),
                    UploadedBy = InitiatorId,
                    UploadedAt = DateTime.UtcNow
                });

                await setupContext.SaveChangesAsync();
            }

            await using (var assertionContext = new AppDbContext(options))
            {
                var controller = CreateController(assertionContext, tempDir.DirectoryPath);

                var result = await controller.Download(1, 2, inline: false, ct: CancellationToken.None);
                var fileResult = Assert.IsType<FileStreamResult>(result);

                using var reader = new StreamReader(fileResult.FileStream);
                var text = await reader.ReadToEndAsync();
                Assert.Equal("legacy-file", text);
            }
        }
    

[Fact]
        public async Task Download_ReturnsNotFound_WhenNoPathAvailable()
        {
            await using var connection = new SqliteConnection("DataSource=:memory:");
            await connection.OpenAsync();
            var options = CreateOptions(connection);

            using var tempDir = new TempDirectory();

            await using (var setupContext = new AppDbContext(options))
            {
                await setupContext.Database.EnsureCreatedAsync();
                await SeedFundRequestAsync(setupContext);

                setupContext.Attachments.Add(new Attachment
                {
                    Id = 3,
                    FundRequestId = 1,
                    FileName = "missing.txt",
                    ContentType = "text/plain",
                    FileSize = 0,
                    StoragePath = string.Empty,
                    LegacyFilePath = null,
                    UploadedBy = InitiatorId,
                    UploadedAt = DateTime.UtcNow
                });

                await setupContext.SaveChangesAsync();
            }

            await using (var assertionContext = new AppDbContext(options))
            {
                var controller = CreateController(assertionContext, tempDir.DirectoryPath);

                var result = await controller.Download(1, 3, inline: false, ct: CancellationToken.None);
                var notFound = Assert.IsType<NotFoundObjectResult>(result);
                Assert.Equal("File missing on server.", notFound.Value);
            }
        }

        [Fact]
        public async Task Download_ThrowsHelpfulError_WhenLegacyColumnMissing()
        {
            await using var connection = new SqliteConnection("DataSource=:memory:");
            await connection.OpenAsync();

            const string schemaSql = @"
CREATE TABLE FundRequests (
    Id INTEGER PRIMARY KEY,
    RequestTitle TEXT,
    InitiatorId INTEGER NOT NULL,
    WorkflowId INTEGER NOT NULL,
    DepartmentId INTEGER NOT NULL,
    Status TEXT NOT NULL,
    Amount REAL NOT NULL
);
CREATE TABLE Attachments (
    Id INTEGER PRIMARY KEY,
    FundRequestId INTEGER NOT NULL,
    FileName TEXT,
    ContentType TEXT,
    FileSize INTEGER,
    StoragePath TEXT,
    UploadedBy INTEGER,
    UploadedAt TEXT
);
";

            using (var command = connection.CreateCommand())
            {
                command.CommandText = schemaSql;
                await command.ExecuteNonQueryAsync();
            }

            var options = CreateOptions(connection);

            using var tempDir = new TempDirectory();

            await using (var setupContext = new AppDbContext(options))
            {
                await setupContext.Database.ExecuteSqlRawAsync(
                    "INSERT INTO FundRequests (Id, RequestTitle, InitiatorId, WorkflowId, DepartmentId, Status, Amount) VALUES (1, 'Test', {0}, 1, 1, 'Pending', 100)",
                    InitiatorId);

                await setupContext.Database.ExecuteSqlRawAsync(
                    "INSERT INTO Attachments (Id, FundRequestId, FileName, ContentType, FileSize, StoragePath, UploadedBy, UploadedAt) VALUES (1, 1, 'legacy.txt', 'text/plain', 0, '', {0}, datetime('now'))",
                    InitiatorId);
            }

            await using (var assertionContext = new AppDbContext(options))
            {
                var controller = CreateController(assertionContext, tempDir.DirectoryPath);

                var ex = await Assert.ThrowsAsync<SqliteException>(() => controller.Download(1, 1, inline: false, ct: CancellationToken.None));
                Assert.Contains("FilePath", ex.Message, StringComparison.OrdinalIgnoreCase);
            }
        }
    }
}        