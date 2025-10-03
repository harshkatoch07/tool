namespace FundApproval.Api.Services.Notifications
{
    public interface INotificationOrchestrator
    {
        System.Threading.Tasks.Task OnInitiatedAsync(
            int fundRequestId,
            int initiatorUserId,
            int firstApproverUserId,
            System.Threading.CancellationToken ct);

        System.Threading.Tasks.Task OnStepApprovedAsync(
            int fundRequestId,
            int initiatorUserId,
            int approvedStepSeq,
            int? nextApproverUserId,
            bool isFinal,
            System.Threading.CancellationToken ct);

        System.Threading.Tasks.Task OnRejectedAsync(
            int fundRequestId,
            int initiatorUserId,
            int rejectedStepSeq,
            int rejectedByUserId,
            string reason,
            System.Threading.CancellationToken ct);
    }
}
