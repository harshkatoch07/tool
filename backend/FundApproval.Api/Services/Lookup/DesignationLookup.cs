using System.Collections.Generic;
using System.Data;
using System.Threading.Tasks;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace FundApproval.Api.Services.Lookups
{
    public interface IDesignationLookup
    {
        Task<string?> GetNameByIdAsync(int designationId);
        Task<List<(int Id, string Name)>> SearchAsync(string? query, int top = 20);
    }

    public class DesignationLookup : IDesignationLookup
    {
        private readonly string _connStr;
        public DesignationLookup(IConfiguration cfg)
        {
            _connStr = cfg.GetConnectionString("DefaultConnection")
                      ?? throw new System.InvalidOperationException("Missing DefaultConnection.");
        }

        public async Task<string?> GetNameByIdAsync(int designationId)
        {
            const string sql = @"
SELECT TOP 1 DesignationName
FROM dbo.Product_MST_Designation WITH (NOLOCK)
WHERE DesignationID = @id;";

            await using var conn = new SqlConnection(_connStr);
            await conn.OpenAsync();
            await using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.Add(new SqlParameter("@id", SqlDbType.Int){ Value = designationId });
            var result = await cmd.ExecuteScalarAsync();
            return result as string;
        }

        public async Task<List<(int Id, string Name)>> SearchAsync(string? query, int top = 20)
        {
            var list = new List<(int, string)>();
            var hasQuery = !string.IsNullOrWhiteSpace(query);

            var sql = hasQuery
                ? @"
SELECT TOP(@top) DesignationID, DesignationName
FROM dbo.Product_MST_Designation WITH (NOLOCK)
WHERE DesignationName IS NOT NULL
  AND DesignationName LIKE @q
ORDER BY DesignationName;"
                : @"
SELECT TOP(@top) DesignationID, DesignationName
FROM dbo.Product_MST_Designation WITH (NOLOCK)
WHERE DesignationName IS NOT NULL
ORDER BY DesignationName;";

            await using var conn = new SqlConnection(_connStr);
            await conn.OpenAsync();
            await using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.Add(new SqlParameter("@top", SqlDbType.Int){ Value = top });
            if (hasQuery)
                cmd.Parameters.Add(new SqlParameter("@q", SqlDbType.NVarChar, 255){ Value = $"%{query!.Trim()}%" });

            await using var rdr = await cmd.ExecuteReaderAsync();
            while (await rdr.ReadAsync())
            {
                var id = rdr.GetInt32(0);
                var name = rdr.IsDBNull(1) ? "" : rdr.GetString(1);
                list.Add((id, name));
            }
            return list;
        }
    }
}
