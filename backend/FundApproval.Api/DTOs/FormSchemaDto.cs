namespace FundApproval.Api.DTOs
{
    public class FormSchemaDto
    {
        public int WorkflowId { get; set; }
        public string TemplateCode { get; set; } = "";
        public SchemaNode Schema { get; set; } = new();

        public class SchemaNode { public List<Field> Fields { get; set; } = new(); }

        public class Field
        {
            public string Key { get; set; } = "";
            public string Label { get; set; } = "";
            public string Type { get; set; } = "text"; // text|textarea|select|url
            public bool Required { get; set; }
            public List<Option>? Options { get; set; }
            public bool? FullWidth { get; set; }
        }

        public class Option { public string Value { get; set; } = ""; public string Label { get; set; } = ""; }
    }
}
