using System.Collections.Generic;
using FundApproval.Api.Services;
using System.Threading.Tasks;
using FundApproval.Api.Models; // Assuming User is here
using FundApproval.Api.DTOs;  // Assuming DTOs are here

namespace FundApproval.Api.Services
{
    public interface IUserAdminService
    {
        Task<IEnumerable<User>> GetAllAsync();
        Task<User> CreateAsync(CreateUserDto dto);
        Task<User> UpdateAsync(int id, UpdateUserDto dto);
        Task DeleteAsync(int id);
    }
}
