using FundApproval.Api.DTOs;
using FundApproval.Api.Models;

namespace FundApproval.Api.Services
{
    public interface IFormSchemaBuilder
    {
        FormSchemaDto Build(Workflow wf);
    }

    public class FormSchemaBuilder : IFormSchemaBuilder
    {
        public FormSchemaDto Build(Workflow wf)
        {
            var dto = new FormSchemaDto
            {
                WorkflowId = wf.WorkflowId,
                TemplateCode = wf.Template ?? "Header_P",
                Schema = new FormSchemaDto.SchemaNode()
            };

            // Always include hyperlink fields
            dto.Schema.Fields.Add(new FormSchemaDto.Field { Key = "hyperlinkTitle", Label = "Hyperlink Title", Type = "text", Required = false });
            dto.Schema.Fields.Add(new FormSchemaDto.Field { Key = "hyperlinkUrl", Label = "Hyperlink URL", Type = "url", Required = false });

            var code = (wf.Template ?? "").Trim();
            var suffix = code.StartsWith("Header_", StringComparison.OrdinalIgnoreCase)
                ? code.Substring("Header_".Length) : code;

            foreach (var c in suffix.ToUpperInvariant())
            {
                switch (c)
                {
                    case 'P': dto.Schema.Fields.Add(new() { Key = "projectId", Label = "Project", Type = "select", Required = true }); break;
                    case 'E': dto.Schema.Fields.Add(new() { Key = "employee", Label = "Employee", Type = "text", Required = false }); break;
                    case 'L': dto.Schema.Fields.Add(new() { Key = "legalEntity", Label = "Legal Entity", Type = "select", Required = false }); break;
                    case 'M': dto.Schema.Fields.Add(new() { Key = "municipalCorp", Label = "Municipal Corporation", Type = "text", Required = false }); break;
                    case 'W': dto.Schema.Fields.Add(new() { Key = "woPoNumber", Label = "WO/PO Number", Type = "text", Required = false }); break;
                    case 'F': dto.Schema.Fields.Add(new() { Key = "justification", Label = "Justification", Type = "textarea", Required = false }); break;
                    case 'C': dto.Schema.Fields.Add(new() { Key = "customer", Label = "Customer", Type = "text", Required = false }); break;
                }
            }

            return dto;
        }
    }
}
