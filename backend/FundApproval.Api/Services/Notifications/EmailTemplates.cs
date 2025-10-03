using FundApproval.Api.Models;

namespace FundApproval.Api.Services.Notifications
{
    public static class EmailTemplates
    {
        public static string InitiatorAck(FundRequest req) =>
            $@"<h3>Request #{req.Id} submitted</h3>
<p>Project: <b>{req.Project?.Name}</b> | Amount: <b>{req.Amount:C}</b></p>
<p>You’ll be notified at each step.</p>";

        public static string ApproverAction(FundRequest req, User approver)
        {
            var link = $"https://your-frontend/approvals/{req.Id}";
            return $@"<h3>Approval required: Request #{req.Id}</h3>
<p>Project: <b>{req.Project?.Name}</b> | Amount: <b>{req.Amount:C}</b></p>
<p><a href=""{link}"">Open request</a> to approve or reject.</p>";
        }

        public static string FinalApproved(FundRequest req) =>
            $@"<h3>Request #{req.Id} Approved ✅</h3>
<p>Project: <b>{req.Project?.Name}</b> | Amount: <b>{req.Amount:C}</b></p>";

        public static string Rejected(FundRequest req, string reason) =>
            $@"<h3>Request #{req.Id} Rejected ❌</h3>
<p>Reason: <i>{System.Net.WebUtility.HtmlEncode(reason)}</i></p>";
    }
}
