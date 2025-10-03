using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FundApproval.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddApprovalTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Approvals_FundRequests_FundRequestId",
                table: "Approvals");

            migrationBuilder.DropForeignKey(
                name: "FK_Approvals_Product_MST_UserSource_ApproverId",
                table: "Approvals");

            migrationBuilder.DropForeignKey(
                name: "FK_FundRequests_Product_MST_UserSource_InitiatorId",
                table: "FundRequests");

            migrationBuilder.DropTable(
                name: "WorkflowStepUsers");

            migrationBuilder.DropColumn(
                name: "FirstName",
                table: "Product_MST_UserSource");

            migrationBuilder.DropColumn(
                name: "LastName",
                table: "Product_MST_UserSource");

            migrationBuilder.DropColumn(
                name: "Department",
                table: "FundRequests");

            migrationBuilder.DropColumn(
                name: "Project",
                table: "FundRequests");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "FundRequests");

            migrationBuilder.RenameColumn(
                name: "LoginName",
                table: "Product_MST_UserSource",
                newName: "Username");

            migrationBuilder.RenameColumn(
                name: "EmployeeID",
                table: "Product_MST_UserSource",
                newName: "UserID");

            migrationBuilder.RenameColumn(
                name: "InitiatorId",
                table: "FundRequests",
                newName: "RequestorId");

            migrationBuilder.RenameColumn(
                name: "Title",
                table: "FundRequests",
                newName: "RequestTitle");

            migrationBuilder.RenameIndex(
                name: "IX_FundRequests_InitiatorId",
                table: "FundRequests",
                newName: "IX_FundRequests_RequestorId");

            migrationBuilder.AlterColumn<int>(
                name: "Sequence",
                table: "WorkflowSteps",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<int>(
                name: "SLAHours",
                table: "WorkflowSteps",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<bool>(
                name: "IsFinalReceiver",
                table: "WorkflowSteps",
                type: "bit",
                nullable: true,
                oldClrType: typeof(bool),
                oldType: "bit");

            migrationBuilder.AlterColumn<bool>(
                name: "AutoApprove",
                table: "WorkflowSteps",
                type: "bit",
                nullable: true,
                oldClrType: typeof(bool),
                oldType: "bit");

            migrationBuilder.AddColumn<string>(
                name: "AssignedUserName",
                table: "WorkflowSteps",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DesignationName",
                table: "WorkflowSteps",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<string>(
                name: "TextBoxName",
                table: "Workflows",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "Template",
                table: "Workflows",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "Workflows",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<int>(
                name: "DepartmentId",
                table: "Workflows",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<int>(
                name: "ProjectID",
                table: "Product_MST_UserSource",
                type: "int",
                nullable: true,
                oldClrType: typeof(short),
                oldType: "smallint",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Password",
                table: "Product_MST_UserSource",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "EmailID",
                table: "Product_MST_UserSource",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<int>(
                name: "DepartmentID",
                table: "Product_MST_UserSource",
                type: "int",
                nullable: true,
                oldClrType: typeof(short),
                oldType: "smallint",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DesignationName",
                table: "Product_MST_UserSource",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "FullName",
                table: "Product_MST_UserSource",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<int>(
                name: "DepartmentID",
                table: "Product_MST_Designation",
                type: "int",
                nullable: false,
                oldClrType: typeof(short),
                oldType: "smallint");

            migrationBuilder.AlterColumn<int>(
                name: "DesignationID",
                table: "Product_MST_Designation",
                type: "int",
                nullable: false,
                oldClrType: typeof(short),
                oldType: "smallint")
                .Annotation("SqlServer:Identity", "1, 1")
                .OldAnnotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "DepartmentID",
                table: "Product_MST_Department",
                type: "int",
                nullable: false,
                oldClrType: typeof(short),
                oldType: "smallint")
                .Annotation("SqlServer:Identity", "1, 1")
                .OldAnnotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "FundRequests",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "WorkflowId",
                table: "FundRequests",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AlterColumn<string>(
                name: "Comments",
                table: "Approvals",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.CreateTable(
                name: "WorkflowFinalReceivers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    WorkflowId = table.Column<int>(type: "int", nullable: false),
                    DesignationName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkflowFinalReceivers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkflowFinalReceivers_Workflows_WorkflowId",
                        column: x => x.WorkflowId,
                        principalTable: "Workflows",
                        principalColumn: "WorkflowId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FundRequests_WorkflowId",
                table: "FundRequests",
                column: "WorkflowId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowFinalReceivers_WorkflowId",
                table: "WorkflowFinalReceivers",
                column: "WorkflowId");

            migrationBuilder.AddForeignKey(
                name: "FK_Approvals_FundRequests_FundRequestId",
                table: "Approvals",
                column: "FundRequestId",
                principalTable: "FundRequests",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Approvals_Product_MST_UserSource_ApproverId",
                table: "Approvals",
                column: "ApproverId",
                principalTable: "Product_MST_UserSource",
                principalColumn: "UserID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_FundRequests_Product_MST_UserSource_RequestorId",
                table: "FundRequests",
                column: "RequestorId",
                principalTable: "Product_MST_UserSource",
                principalColumn: "UserID",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_FundRequests_Workflows_WorkflowId",
                table: "FundRequests",
                column: "WorkflowId",
                principalTable: "Workflows",
                principalColumn: "WorkflowId",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Approvals_FundRequests_FundRequestId",
                table: "Approvals");

            migrationBuilder.DropForeignKey(
                name: "FK_Approvals_Product_MST_UserSource_ApproverId",
                table: "Approvals");

            migrationBuilder.DropForeignKey(
                name: "FK_FundRequests_Product_MST_UserSource_RequestorId",
                table: "FundRequests");

            migrationBuilder.DropForeignKey(
                name: "FK_FundRequests_Workflows_WorkflowId",
                table: "FundRequests");

            migrationBuilder.DropTable(
                name: "WorkflowFinalReceivers");

            migrationBuilder.DropIndex(
                name: "IX_FundRequests_WorkflowId",
                table: "FundRequests");

            migrationBuilder.DropColumn(
                name: "AssignedUserName",
                table: "WorkflowSteps");

            migrationBuilder.DropColumn(
                name: "DesignationName",
                table: "WorkflowSteps");

            migrationBuilder.DropColumn(
                name: "DesignationName",
                table: "Product_MST_UserSource");

            migrationBuilder.DropColumn(
                name: "FullName",
                table: "Product_MST_UserSource");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "FundRequests");

            migrationBuilder.DropColumn(
                name: "WorkflowId",
                table: "FundRequests");

            migrationBuilder.RenameColumn(
                name: "Username",
                table: "Product_MST_UserSource",
                newName: "LoginName");

            migrationBuilder.RenameColumn(
                name: "UserID",
                table: "Product_MST_UserSource",
                newName: "EmployeeID");

            migrationBuilder.RenameColumn(
                name: "RequestorId",
                table: "FundRequests",
                newName: "InitiatorId");

            migrationBuilder.RenameColumn(
                name: "RequestTitle",
                table: "FundRequests",
                newName: "Title");

            migrationBuilder.RenameIndex(
                name: "IX_FundRequests_RequestorId",
                table: "FundRequests",
                newName: "IX_FundRequests_InitiatorId");

            migrationBuilder.AlterColumn<int>(
                name: "Sequence",
                table: "WorkflowSteps",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "SLAHours",
                table: "WorkflowSteps",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<bool>(
                name: "IsFinalReceiver",
                table: "WorkflowSteps",
                type: "bit",
                nullable: false,
                defaultValue: false,
                oldClrType: typeof(bool),
                oldType: "bit",
                oldNullable: true);

            migrationBuilder.AlterColumn<bool>(
                name: "AutoApprove",
                table: "WorkflowSteps",
                type: "bit",
                nullable: false,
                defaultValue: false,
                oldClrType: typeof(bool),
                oldType: "bit",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "TextBoxName",
                table: "Workflows",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Template",
                table: "Workflows",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "Workflows",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "DepartmentId",
                table: "Workflows",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<short>(
                name: "ProjectID",
                table: "Product_MST_UserSource",
                type: "smallint",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Password",
                table: "Product_MST_UserSource",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "EmailID",
                table: "Product_MST_UserSource",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AlterColumn<short>(
                name: "DepartmentID",
                table: "Product_MST_UserSource",
                type: "smallint",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FirstName",
                table: "Product_MST_UserSource",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastName",
                table: "Product_MST_UserSource",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AlterColumn<short>(
                name: "DepartmentID",
                table: "Product_MST_Designation",
                type: "smallint",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<short>(
                name: "DesignationID",
                table: "Product_MST_Designation",
                type: "smallint",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .Annotation("SqlServer:Identity", "1, 1")
                .OldAnnotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<short>(
                name: "DepartmentID",
                table: "Product_MST_Department",
                type: "smallint",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .Annotation("SqlServer:Identity", "1, 1")
                .OldAnnotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AddColumn<string>(
                name: "Department",
                table: "FundRequests",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Project",
                table: "FundRequests",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "FundRequests",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AlterColumn<string>(
                name: "Comments",
                table: "Approvals",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.CreateTable(
                name: "WorkflowStepUsers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    StepId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkflowStepUsers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkflowStepUsers_WorkflowSteps_StepId",
                        column: x => x.StepId,
                        principalTable: "WorkflowSteps",
                        principalColumn: "StepId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowStepUsers_StepId",
                table: "WorkflowStepUsers",
                column: "StepId");

            migrationBuilder.AddForeignKey(
                name: "FK_Approvals_FundRequests_FundRequestId",
                table: "Approvals",
                column: "FundRequestId",
                principalTable: "FundRequests",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Approvals_Product_MST_UserSource_ApproverId",
                table: "Approvals",
                column: "ApproverId",
                principalTable: "Product_MST_UserSource",
                principalColumn: "EmployeeID",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_FundRequests_Product_MST_UserSource_InitiatorId",
                table: "FundRequests",
                column: "InitiatorId",
                principalTable: "Product_MST_UserSource",
                principalColumn: "EmployeeID",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
