using System;
using System.Collections.Generic;

namespace FundApproval.Api.DTOs.Reports
{
    public class UserActivityReportDto
    {
        public string? Username { get; set; }

        public int TotalItems { get; set; }

        public double AvgMinutes_AssignToDecision { get; set; }

        public int OpenedCount { get; set; }

        public int AttachmentViewedCount { get; set; }

        public IReadOnlyList<UserActivityRow> Rows { get; set; } = Array.Empty<UserActivityRow>();
    }
}