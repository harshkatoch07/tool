using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using FundApproval.Api.Models;
using FundApproval.Api.DTOs.Reports;
using ReportsUserActivityRow = FundApproval.Api.DTOs.Reports.UserActivityRow; // for UserActivityRow (keyless DTO)

namespace FundApproval.Api.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<FundRequest> FundRequests { get; set; }
        public DbSet<FormSchema> FormSchemas { get; set; }
        public DbSet<FundRequestField> FundRequestFields { get; set; }
        public DbSet<Approval> Approvals { get; set; }
        public DbSet<Attachment> Attachments { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }
        public DbSet<Department> Departments { get; set; }
        public DbSet<Designation> Designations { get; set; }
        public DbSet<Project> Projects { get; set; }
        public DbSet<Workflow> Workflows { get; set; }
        public DbSet<WorkflowStep> WorkflowSteps { get; set; }
        public DbSet<WorkflowFinalReceiver> WorkflowFinalReceivers { get; set; }
        public DbSet<UserProject> UserProjects { get; set; }
        public DbSet<EmailOutbox> EmailOutbox => Set<EmailOutbox>();
        public DbSet<FinalReceiverAssignment> FinalReceiverAssignments { get; set; }
        public DbSet<Delegation> Delegations => Set<Delegation>();
        public DbSet<ReportsUserActivityRow> UserActivityRows => Set<ReportsUserActivityRow>();


        // NEW: event ledger for per-user request activity
        public DbSet<RequestAuditEvent> RequestAuditEvents => Set<RequestAuditEvent>();

        // NEW: keyless DTO to read results from sp_Report_UserActivity

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // =============================
            // USER
            // =============================
            modelBuilder.Entity<User>().ToTable("Product_MST_UserSource");
            modelBuilder.Entity<User>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("UserID");
                entity.Property(e => e.Username).HasColumnName("Username");
                entity.Property(e => e.FullName).HasColumnName("FullName");
                entity.Property(e => e.Role).HasColumnName("RoleID").HasConversion<int>();
                entity.Property(e => e.DesignationId).HasColumnName("DesignationId");
                entity.Property(e => e.Email).HasColumnName("EmailID");
                entity.Property(e => e.PasswordHash).HasColumnName("Password");
                entity.Property(e => e.DepartmentId).HasColumnName("DepartmentID");
                entity.Property(e => e.ProjectId).HasColumnName("ProjectID");
                entity.Property(e => e.Mobile).HasColumnName("MobileNumber");
                entity.Property(e => e.Gender).HasColumnName("Gender");
                entity.Property(e => e.DesignationName).HasColumnName("DesignationName");
                // entity.Property(e => e.IsActive).HasColumnName("IsActive"); // enable if you have this column
            });

            // =============================
            // DEPARTMENT
            // =============================
            modelBuilder.Entity<Department>().ToTable("Product_MST_Department");
            modelBuilder.Entity<Department>(entity =>
            {
                entity.HasKey(d => d.DepartmentID);
                entity.Property(d => d.DepartmentID).HasColumnName("DepartmentID");
                entity.Property(d => d.Name).HasColumnName("Name");
                entity.Property(d => d.ShortName).HasColumnName("ShortName");
                entity.Property(d => d.DepartmentHead).HasColumnName("DepartmentHead");
                entity.Property(d => d.IsActive).HasColumnName("IsActive");
            });

            // =============================
            // DESIGNATION
            // =============================
            modelBuilder.Entity<Designation>().ToTable("Product_MST_Designation");
            modelBuilder.Entity<Designation>(entity =>
            {
                entity.HasKey(d => d.Id);
                entity.Property(d => d.Id).HasColumnName("DesignationID");
                entity.Property(d => d.Name).HasColumnName("DesignationName");
                entity.Property(d => d.DepartmentId).HasColumnName("DepartmentID");
                entity.Property(d => d.IsActive).HasColumnName("IsActive");
            });

            // =============================
            // PROJECTS (dbo.Projects)
            // =============================
            modelBuilder.Entity<Project>(entity =>
            {
                entity.ToTable("Projects", "dbo");
                entity.HasKey(p => p.Id);
                entity.Property(p => p.Id).HasColumnName("ProjectID");
                entity.Property(p => p.Name).HasColumnName("ProjectName");
            });

            // =============================
            // WORKFLOWS
            // =============================
            modelBuilder.Entity<Workflow>().ToTable("Workflows");
            modelBuilder.Entity<Workflow>(entity =>
            {
                entity.HasKey(w => w.WorkflowId);
                entity.Property(w => w.Name).HasColumnName("Name");
                entity.Property(w => w.Description).HasColumnName("Description");
                entity.Property(w => w.DepartmentId).HasColumnName("DepartmentId");
                entity.Property(w => w.WorkflowId).HasColumnName("WorkflowId");
                entity.Property(w => w.Name).HasColumnName("Name");
                entity.Property(w => w.Description).HasColumnName("Description");
                entity.Property(w => w.DepartmentId).HasColumnName("DepartmentId");
                entity.Property(w => w.Template).HasColumnName("Template");
                entity.Property(w => w.TextBoxName).HasColumnName("TextBoxName");
                entity.Property(w => w.IsActive).HasColumnName("IsActive");
                entity.Property(w => w.CreatedAt).HasColumnName("CreatedAt");
                entity.Property(w => w.ModifiedAt).HasColumnName("ModifiedAt");
                entity.Property(w => w.ModifiedBy).HasColumnName("ModifiedBy");

                entity.HasMany(w => w.Steps)
                      .WithOne(ws => ws.Workflow)
                      .HasForeignKey(ws => ws.WorkflowId);

                entity.HasMany(w => w.FinalReceivers)
                      .WithOne(fr => fr.Workflow)
                      .HasForeignKey(fr => fr.WorkflowId);
            });

            // =============================
            // WORKFLOW STEPS
            // =============================
            modelBuilder.Entity<WorkflowStep>().ToTable("WorkflowSteps");
            modelBuilder.Entity<WorkflowStep>(entity =>
            {
                entity.HasKey(ws => ws.StepId);
                entity.Property(ws => ws.StepId).HasColumnName("StepId");
                entity.Property(ws => ws.WorkflowId).HasColumnName("WorkflowId");
                entity.Property(ws => ws.StepName).HasColumnName("StepName");
                entity.Property(ws => ws.Sequence).HasColumnName("Sequence");
                entity.Property(ws => ws.SLAHours).HasColumnName("SLAHours");
                entity.Property(ws => ws.AutoApprove).HasColumnName("AutoApprove");
                entity.Property(ws => ws.IsFinalReceiver).HasColumnName("IsFinalReceiver");
                entity.Property(ws => ws.DesignationId).HasColumnName("DesignationId");
                entity.Property(ws => ws.DesignationName).HasColumnName("DesignationName");
                entity.Property(ws => ws.AssignedUserName).HasColumnName("AssignedUserName");

                entity.HasOne(ws => ws.Workflow)
                      .WithMany(w => w.Steps)
                      .HasForeignKey(ws => ws.WorkflowId);

                entity.HasOne(ws => ws.Designation)
                      .WithMany()
                      .HasForeignKey(ws => ws.DesignationId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            // =============================
            // WORKFLOW FINAL RECEIVERS
            // =============================
            modelBuilder.Entity<WorkflowFinalReceiver>().ToTable("WorkflowFinalReceivers");
            modelBuilder.Entity<WorkflowFinalReceiver>(entity =>
            {
                entity.HasKey(fr => fr.Id);
                entity.Property(fr => fr.Id).HasColumnName("Id");
                entity.Property(fr => fr.WorkflowId).HasColumnName("WorkflowId");
                entity.Property(fr => fr.UserId).HasColumnName("UserId");
                entity.Property(fr => fr.DesignationId).HasColumnName("DesignationId");
                entity.Property(fr => fr.DesignationName).HasColumnName("DesignationName");

                entity.HasOne(fr => fr.Workflow)
                      .WithMany(w => w.FinalReceivers)
                      .HasForeignKey(fr => fr.WorkflowId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(fr => fr.User)
                      .WithMany()
                      .HasForeignKey(fr => fr.UserId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(fr => fr.Designation)
                      .WithMany()
                      .HasForeignKey(fr => fr.DesignationId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            // =============================
            // FORM SCHEMAS
            // =============================
            modelBuilder.Entity<FormSchema>().ToTable("FormSchemas");
            modelBuilder.Entity<FormSchema>(entity =>
            {
                entity.HasKey(fs => fs.Id);
                entity.Property(fs => fs.Id).HasColumnName("Id");
                entity.Property(fs => fs.Department).HasColumnName("Department");
                entity.Property(fs => fs.DepartmentName).HasColumnName("DepartmentName");
                entity.Property(fs => fs.Project).HasColumnName("Project");
                entity.Property(fs => fs.SchemaJson).HasColumnName("SchemaJson");
                entity.Property(fs => fs.IsActive).HasColumnName("IsActive");
            });

            // =============================
            // FUND REQUESTS
            // =============================
            modelBuilder.Entity<FundRequest>().ToTable("FundRequests");
            modelBuilder.Entity<FundRequest>(entity =>
            {
                entity.HasKey(fr => fr.Id);
                entity.Property(fr => fr.Id).HasColumnName("Id");
                entity.Property(fr => fr.RequestTitle).HasColumnName("RequestTitle").HasMaxLength(256).IsRequired();
                entity.Property(fr => fr.Description).HasColumnName("Description");

                entity.Property(fr => fr.Amount).HasColumnName("Amount").HasColumnType("decimal(18,2)");
                entity.HasCheckConstraint("CK_FundRequests_Amount_Positive", "[Amount] > 0");

                entity.Property(fr => fr.InitiatorId).HasColumnName("InitiatorId").IsRequired();
                entity.Property(fr => fr.WorkflowId).HasColumnName("WorkflowId").IsRequired();
                entity.Property(fr => fr.DepartmentId).HasColumnName("DepartmentId").IsRequired();
                entity.Property(fr => fr.ProjectId).HasColumnName("ProjectId");

                entity.Property(fr => fr.Status).HasColumnName("Status").HasMaxLength(32).IsRequired();
                entity.Property(fr => fr.CurrentLevel).HasColumnName("CurrentLevel").HasDefaultValue(0);
                entity.Property(fr => fr.NeededBy).HasColumnName("NeededBy");

                entity.Property(fr => fr.CreatedAt)
                      .HasColumnName("CreatedAt")
                      .HasDefaultValueSql("GETUTCDATE()");

                entity.HasOne(fr => fr.Workflow)
                      .WithMany()
                      .HasForeignKey(fr => fr.WorkflowId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(fr => fr.Department)
                      .WithMany()
                      .HasForeignKey(fr => fr.DepartmentId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(fr => fr.Project)
                      .WithMany()
                      .HasForeignKey(fr => fr.ProjectId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(fr => new { fr.Status, fr.DepartmentId, fr.WorkflowId })
                      .HasDatabaseName("IX_FundRequests_Status_Dept_Workflow");
            });

            // =============================
            // FUND REQUEST FIELDS
            // =============================
            modelBuilder.Entity<FundRequestField>().ToTable("FundRequestFields");
            modelBuilder.Entity<FundRequestField>(entity =>
            {
                entity.HasKey(f => f.Id);
                entity.Property(f => f.Id).HasColumnName("Id");
                entity.Property(f => f.FundRequestId).HasColumnName("FundRequestId");
                entity.Property(f => f.FieldName).HasColumnName("FieldName");
                entity.Property(f => f.FieldValue).HasColumnName("FieldValue");

                entity.HasOne(f => f.FundRequest)
                      .WithMany(r => r.Fields)
                      .HasForeignKey(f => f.FundRequestId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // =============================
            // APPROVALS
            // =============================
            modelBuilder.Entity<Approval>().ToTable("Approvals");
            modelBuilder.Entity<Approval>(entity =>
            {
                entity.HasKey(a => a.Id);
                entity.Property(a => a.Id).HasColumnName("Id");
                entity.Property(a => a.FundRequestId).HasColumnName("FundRequestId");
                entity.Property(a => a.Level).HasColumnName("Level");
                entity.Property(a => a.ApproverId).HasColumnName("ApproverId");
                entity.Property(a => a.Status).HasColumnName("Status");
                entity.Property(a => a.Comments).HasColumnName("Comments").IsRequired(false);

                entity.Property(a => a.AssignedAt).HasColumnName("AssignedAt").IsRequired(false);
                entity.Property(a => a.ActionedAt).HasColumnName("ActionedAt").IsRequired(false);
                entity.Property(a => a.ApprovedAt).HasColumnName("ApprovedAt").IsRequired(false);
                entity.Property(a => a.OverriddenUserId).HasColumnName("OverriddenUserId").IsRequired(false);

                entity.HasOne(a => a.FundRequest)
                      .WithMany(f => f.Approvals)
                      .HasForeignKey(a => a.FundRequestId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(a => a.Approver)
                      .WithMany()
                      .HasForeignKey(a => a.ApproverId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(a => new { a.FundRequestId, a.Level, a.ApproverId })
                      .HasFilter("[Status] = N'Pending'")
                      .IsUnique()
                      .HasDatabaseName("UX_Approvals_OnePendingPerLevelPerUser");

                entity.HasIndex(a => new { a.ApproverId, a.Status })
                      .HasDatabaseName("IX_Approvals_Approver_Status");
            });

            // =============================
            // ATTACHMENTS
            // =============================

            // =============================
            // AUDIT LOGS
            // =============================
            modelBuilder.Entity<AuditLog>().ToTable("AuditLogs");
            modelBuilder.Entity<AuditLog>(entity =>
            {
                entity.HasKey(a => a.Id);
                entity.Property(a => a.Id).HasColumnName("Id");
                entity.Property(a => a.Event).HasColumnName("Event").HasMaxLength(64);
                entity.Property(a => a.Entity).HasColumnName("Entity").HasMaxLength(64);
                entity.Property(a => a.EntityId).HasColumnName("EntityId");
                entity.Property(a => a.ActorId).HasColumnName("UserId"); // DB column is UserId in some schemas
                entity.Property(a => a.ActorName).HasColumnName("ActorName");
                entity.Property(a => a.Comments).HasColumnName("Comments");
                entity.Property(a => a.CreatedAt).HasColumnName("Timestamp"); // DB column is Timestamp in some schemas
                entity.Ignore(a => a.Ip); // DB does not have Ip
            }); modelBuilder.Entity<Attachment>().ToTable("Attachments");
            modelBuilder.Entity<Attachment>(entity =>
            {
                entity.HasKey(a => a.Id);
                entity.Property(a => a.Id).HasColumnName("Id");
                entity.Property(a => a.FundRequestId).HasColumnName("FundRequestId");
                entity.Property(a => a.FileName).HasColumnName("FileName").HasMaxLength(255);
                entity.Property(a => a.ContentType).HasColumnName("ContentType").HasMaxLength(200);
                entity.Property(a => a.FileSize).HasColumnName("FileSize");
                entity.Property(a => a.StoragePath).HasColumnName("StoragePath").HasMaxLength(1024);
                entity.Property(a => a.LegacyFilePath).HasColumnName("FilePath").HasMaxLength(1024);
                entity.Property(a => a.UploadedBy).HasColumnName("UploadedBy");
                entity.Property(a => a.UploadedAt).HasColumnName("UploadedAt");
                entity.Property(a => a.Sha256).HasColumnName("Sha256").HasMaxLength(64);

                entity.HasOne(a => a.FundRequest)
                      .WithMany(fr => fr.Attachments)
                      .HasForeignKey(a => a.FundRequestId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // =============================
            // USER ⇄ PROJECT JOIN (dbo.UserProjects)
            // =============================
            modelBuilder.Entity<UserProject>(b =>
            {
                b.ToTable("UserProjects", "dbo");
                b.HasKey(x => new { x.ProjectId, x.EmailID });
                b.Property(x => x.ProjectId).HasColumnName("ProjectId").IsRequired();
                b.Property(x => x.EmailID).HasColumnName("EmailID").HasMaxLength(320).IsRequired();
                b.Ignore("UserId");
                b.HasOne(x => x.Project)
                 .WithMany()
                 .HasForeignKey(x => x.ProjectId)
                 .OnDelete(DeleteBehavior.Cascade);
            });

            // =============================
            // DELEGATIONS
            // =============================
            modelBuilder.Entity<Delegation>(e =>
            {
                e.ToTable("Delegations");
                e.HasKey(x => x.Id);

                e.Property(x => x.FromUserId).HasColumnName("FromUserId").IsRequired();
                e.Property(x => x.ToUserId).HasColumnName("ToUserId").IsRequired();
                e.Property(x => x.StartsAtUtc).HasColumnName("StartsAtUtc").IsRequired();
                e.Property(x => x.EndsAtUtc).HasColumnName("EndsAtUtc").IsRequired();
                e.Property(x => x.CreatedAtUtc).HasColumnName("CreatedAtUtc").HasDefaultValueSql("sysutcdatetime()");
                e.Property(x => x.IsRevoked).HasColumnName("IsRevoked").HasDefaultValue(false);

                e.HasOne(d => d.FromUser)
                 .WithMany(u => u.DelegationsFrom)
                 .HasForeignKey(d => d.FromUserId)
                 .OnDelete(DeleteBehavior.Restrict)
                 .IsRequired();

                e.HasOne(d => d.ToUser)
                 .WithMany(u => u.DelegationsTo)
                 .HasForeignKey(d => d.ToUserId)
                 .OnDelete(DeleteBehavior.Restrict)
                 .IsRequired();

                e.HasIndex(x => new { x.FromUserId, x.ToUserId, x.IsRevoked, x.StartsAtUtc, x.EndsAtUtc })
                 .HasDatabaseName("IX_Delegations_ActiveWindow");

                e.HasIndex(x => new { x.ToUserId, x.IsRevoked, x.StartsAtUtc, x.EndsAtUtc })
                 .HasDatabaseName("IX_Delegations_Lookup_ByDelegate");
            });

            // =============================
            // NEW: REQUEST AUDIT EVENTS
            // =============================
            modelBuilder.Entity<RequestAuditEvent>(e =>
            {
                e.ToTable("RequestAuditEvents");
                e.HasKey(x => x.Id);
                e.Property(x => x.Id).HasColumnName("Id");
                e.Property(x => x.RequestId).HasColumnName("RequestId").IsRequired();
                e.Property(x => x.StepId).HasColumnName("StepId");
                e.Property(x => x.AssigneeUserId).HasColumnName("AssigneeUserId");
                e.Property(x => x.ActorUserId).HasColumnName("ActorUserId").IsRequired();
                e.Property(x => x.EventType).HasColumnName("EventType").HasMaxLength(40).IsRequired();
                e.Property(x => x.MetaJson).HasColumnName("MetaJson");
                e.Property(x => x.OccurredAtUtc).HasColumnName("OccurredAtUtc");
                e.HasIndex(x => new { x.RequestId, x.OccurredAtUtc });
                e.HasIndex(x => new { x.AssigneeUserId, x.OccurredAtUtc });
                e.HasIndex(x => new { x.ActorUserId, x.OccurredAtUtc });
                e.HasIndex(x => new { x.EventType, x.OccurredAtUtc });
            });

            // =============================
            // NEW: keyless mapping for SP result
            // =============================
            // Keyless mapping for API-projected report rows
            // Keyless mapping for API-projected report rows
            modelBuilder.Entity<ReportsUserActivityRow>(e =>
            {
                e.HasNoKey();
                e.ToView(null);
                e.Property(p => p.FundRequestId).HasColumnName("FundRequestId");
                e.Property(p => p.RequestTitle).HasColumnName("RequestTitle");
                e.Property(p => p.WorkflowName).HasColumnName("WorkflowName");
                e.Property(p => p.ProjectName).HasColumnName("ProjectName");
                e.Property(p => p.DepartmentName).HasColumnName("DepartmentName");
                e.Property(p => p.ApproverName).HasColumnName("ApproverName");
                e.Property(p => p.AssignedAt).HasColumnName("AssignedAt");
                e.Property(p => p.FirstOpenedAt).HasColumnName("FirstOpenedAt");
                e.Property(p => p.FirstOpenedLatencySecs).HasColumnName("FirstOpenedLatencySecs");
                e.Property(p => p.ApprovedAt).HasColumnName("ApprovedAt");
                e.Property(p => p.ApprovalLatencySecs).HasColumnName("ApprovalLatencySecs");
                e.Property(p => p.Decision).HasColumnName("Decision");
                e.Property(p => p.AttachmentViewsCount).HasColumnName("AttachmentViewsCount");
                e.Property(p => p.AttachmentFirstViewedAt).HasColumnName("AttachmentFirstViewedAt");
            });


        }
               public Task<int> InsertAuditLogAsync(AuditLog log, CancellationToken ct = default)
        {
            return Database.ExecuteSqlInterpolatedAsync(
                $@"
                    INSERT INTO [AuditLogs] ([Event], [Entity], [EntityId], [UserId], [ActorName], [Comments], [Timestamp])
                    VALUES ({log.Event}, {log.Entity}, {log.EntityId}, {log.ActorId}, {log.ActorName}, {log.Comments}, {log.CreatedAt})
                ",
                ct);
        }
    }
}


