using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FundApproval.Api.Migrations
{
    /// <inheritdoc />
    public partial class SyncSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FundRequests_Product_MST_UserSource_RequestorId",
                table: "FundRequests");

            migrationBuilder.DropIndex(
                name: "IX_FundRequests_RequestorId",
                table: "FundRequests");

            migrationBuilder.RenameColumn(
                name: "RequestorId",
                table: "FundRequests",
                newName: "InitiatorId");

            migrationBuilder.RenameColumn(
                name: "ProjectType",
                table: "FormSchemas",
                newName: "DepartmentName");

            migrationBuilder.AddColumn<int>(
                name: "DesignationId",
                table: "WorkflowSteps",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DesignationId1",
                table: "WorkflowSteps",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "DesignationId",
                table: "Product_MST_UserSource",
                type: "int",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "SalaryGrade",
                table: "Product_MST_Designation",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "DesignationName",
                table: "Product_MST_Designation",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "FundRequests",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DepartmentId",
                table: "FundRequests",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ProjectId",
                table: "FundRequests",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowSteps_DesignationId",
                table: "WorkflowSteps",
                column: "DesignationId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowSteps_DesignationId1",
                table: "WorkflowSteps",
                column: "DesignationId1");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowFinalReceivers_UserId",
                table: "WorkflowFinalReceivers",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_FundRequests_DepartmentId",
                table: "FundRequests",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_FundRequests_ProjectId",
                table: "FundRequests",
                column: "ProjectId");

            migrationBuilder.AddForeignKey(
                name: "FK_FundRequests_Product_MST_CAPEA_ProjectId",
                table: "FundRequests",
                column: "ProjectId",
                principalTable: "Product_MST_CAPEA",
                principalColumn: "ProjectID");

            migrationBuilder.AddForeignKey(
                name: "FK_FundRequests_Product_MST_Department_DepartmentId",
                table: "FundRequests",
                column: "DepartmentId",
                principalTable: "Product_MST_Department",
                principalColumn: "DepartmentID",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_WorkflowFinalReceivers_Product_MST_UserSource_UserId",
                table: "WorkflowFinalReceivers",
                column: "UserId",
                principalTable: "Product_MST_UserSource",
                principalColumn: "UserID",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_WorkflowSteps_Product_MST_Designation_DesignationId",
                table: "WorkflowSteps",
                column: "DesignationId",
                principalTable: "Product_MST_Designation",
                principalColumn: "DesignationID");

            migrationBuilder.AddForeignKey(
                name: "FK_WorkflowSteps_Product_MST_Designation_DesignationId1",
                table: "WorkflowSteps",
                column: "DesignationId1",
                principalTable: "Product_MST_Designation",
                principalColumn: "DesignationID",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FundRequests_Product_MST_CAPEA_ProjectId",
                table: "FundRequests");

            migrationBuilder.DropForeignKey(
                name: "FK_FundRequests_Product_MST_Department_DepartmentId",
                table: "FundRequests");

            migrationBuilder.DropForeignKey(
                name: "FK_WorkflowFinalReceivers_Product_MST_UserSource_UserId",
                table: "WorkflowFinalReceivers");

            migrationBuilder.DropForeignKey(
                name: "FK_WorkflowSteps_Product_MST_Designation_DesignationId",
                table: "WorkflowSteps");

            migrationBuilder.DropForeignKey(
                name: "FK_WorkflowSteps_Product_MST_Designation_DesignationId1",
                table: "WorkflowSteps");

            migrationBuilder.DropIndex(
                name: "IX_WorkflowSteps_DesignationId",
                table: "WorkflowSteps");

            migrationBuilder.DropIndex(
                name: "IX_WorkflowSteps_DesignationId1",
                table: "WorkflowSteps");

            migrationBuilder.DropIndex(
                name: "IX_WorkflowFinalReceivers_UserId",
                table: "WorkflowFinalReceivers");

            migrationBuilder.DropIndex(
                name: "IX_FundRequests_DepartmentId",
                table: "FundRequests");

            migrationBuilder.DropIndex(
                name: "IX_FundRequests_ProjectId",
                table: "FundRequests");

            migrationBuilder.DropColumn(
                name: "DesignationId",
                table: "WorkflowSteps");

            migrationBuilder.DropColumn(
                name: "DesignationId1",
                table: "WorkflowSteps");

            migrationBuilder.DropColumn(
                name: "DesignationId",
                table: "Product_MST_UserSource");

            migrationBuilder.DropColumn(
                name: "DepartmentId",
                table: "FundRequests");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                table: "FundRequests");

            migrationBuilder.RenameColumn(
                name: "InitiatorId",
                table: "FundRequests",
                newName: "RequestorId");

            migrationBuilder.RenameColumn(
                name: "DepartmentName",
                table: "FormSchemas",
                newName: "ProjectType");

            migrationBuilder.AlterColumn<string>(
                name: "SalaryGrade",
                table: "Product_MST_Designation",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "DesignationName",
                table: "Product_MST_Designation",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "FundRequests",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.CreateIndex(
                name: "IX_FundRequests_RequestorId",
                table: "FundRequests",
                column: "RequestorId");

            migrationBuilder.AddForeignKey(
                name: "FK_FundRequests_Product_MST_UserSource_RequestorId",
                table: "FundRequests",
                column: "RequestorId",
                principalTable: "Product_MST_UserSource",
                principalColumn: "UserID",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
