public class ApprovalRequestDto
{
    public int DepartmentId { get; set; }
    public string Project { get; set; }
    public string Employee { get; set; }
    public string LegalEntity { get; set; }
    public string WhatNeed { get; set; }
    public string WhyNeed { get; set; }
    public DateTime WhenNeed { get; set; }
    public string Urgency { get; set; }
    public string History { get; set; }
    public string Recommend { get; set; }
    public string Reason { get; set; }
    public string HyperlinkTitle { get; set; }
    public List<string> HyperlinkUrl { get; set; }
    public IFormFileCollection Attachments { get; set; }
}
