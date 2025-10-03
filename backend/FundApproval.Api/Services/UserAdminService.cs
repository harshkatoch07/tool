using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using FundApproval.Api.Data;
using FundApproval.Api.Models;
using FundApproval.Api.DTOs;
using FundApproval.Api.Utils;

namespace FundApproval.Api.Services.Admin
{
    public class UserAdminService : IUserAdminService
    {
        private readonly AppDbContext _db;
        public UserAdminService(AppDbContext db) => _db = db;

        public async Task<IEnumerable<User>> GetAllAsync() =>
            await _db.Users.ToListAsync();

        public async Task<User> CreateAsync(CreateUserDto dto)
        {
            var u = new User
            {
                Username     = dto.Username,
                Email        = dto.Email,
                Role         = (short)Enum.Parse<UserRole>(dto.Role, true), // ✅ Cast to short
                PasswordHash = HashUtil.Hash(dto.Password)
            };
            _db.Users.Add(u);
            await _db.SaveChangesAsync();
            return u;
        }

        public async Task<User> UpdateAsync(int id, UpdateUserDto dto)
        {
            var u = await _db.Users.FindAsync(id) ?? throw new KeyNotFoundException();

            u.Email = dto.Email;
            u.Role  = (short)Enum.Parse<UserRole>(dto.Role, true); // ✅ Cast to short

            await _db.SaveChangesAsync();
            return u;
        }

        public async Task DeleteAsync(int id)
        {
            var u = await _db.Users.FindAsync(id) ?? throw new KeyNotFoundException();
            _db.Users.Remove(u);
            await _db.SaveChangesAsync();
        }
    }
}
