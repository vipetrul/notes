using Microsoft.EntityFrameworkCore;

namespace LambdaApi.Database;

public class MyDbContext : DbContext
{
    public DbSet<User> Users { get; set; } = null!;


    public MyDbContext(DbContextOptions<MyDbContext> options) : base(options)
    {
    }
}

public class User
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}