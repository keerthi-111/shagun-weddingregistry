using Microsoft.EntityFrameworkCore;

namespace Shagun.Api;

public class User
{
    public string Id { get; set; } = Ids.New();
    public string Email { get; set; } = "";
    public string Name { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public long CreatedAt { get; set; } = Ids.Now();
}

public class Registry
{
    public string Id { get; set; } = Ids.New();
    public string OwnerId { get; set; } = "";
    public string Slug { get; set; } = "";
    public string Partner1 { get; set; } = "";
    public string Partner2 { get; set; } = "";
    public string Date { get; set; } = "";
    public string City { get; set; } = "";
    public string Venue { get; set; } = "";
    public string Note { get; set; } = "";
    public string Cover { get; set; } = "";
    public string Theme { get; set; } = "marigold";
    public string UpiId { get; set; } = "";
    public string UpiName { get; set; } = "";
    public string Address { get; set; } = "";   // private: only revealed to a guest who reserves a product
    public long CreatedAt { get; set; } = Ids.Now();
}

public class Item
{
    public string Id { get; set; } = Ids.New();
    public string RegistryId { get; set; } = "";
    public string Type { get; set; } = "product";   // product | fund | giftcard
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Url { get; set; } = "";
    public string Image { get; set; } = "";
    public string Store { get; set; } = "";
    public string Category { get; set; } = "";
    public int Price { get; set; }       // whole rupees
    public int Qty { get; set; } = 1;
    public int Target { get; set; }      // whole rupees, 0 = no goal
    public bool MostWanted { get; set; }
    public int SortOrder { get; set; }
    public long CreatedAt { get; set; } = Ids.Now();
}

public class Gift
{
    public string Id { get; set; } = Ids.New();
    public string RegistryId { get; set; } = "";
    public string ItemId { get; set; } = "";
    public string ItemTitle { get; set; } = "";
    public string Type { get; set; } = "";   // purchase | contribution
    public string GuestName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Message { get; set; } = "";
    public int Qty { get; set; }
    public int Amount { get; set; }
    public string OrderRef { get; set; } = "";
    public string UpiRef { get; set; } = "";
    public bool Thanked { get; set; }
    public bool Received { get; set; }
    public long CreatedAt { get; set; } = Ids.Now();
}

public class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Registry> Registries => Set<Registry>();
    public DbSet<Item> Items => Set<Item>();
    public DbSet<Gift> Gifts => Set<Gift>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>().HasIndex(u => u.Email).IsUnique();
        b.Entity<Registry>().HasIndex(r => r.Slug).IsUnique();
        b.Entity<Registry>().HasIndex(r => r.OwnerId).IsUnique();
        b.Entity<Item>().HasIndex(i => i.RegistryId);
        b.Entity<Gift>().HasIndex(g => g.RegistryId);
        b.Entity<Gift>().HasIndex(g => g.ItemId);
    }
}

public static class Ids
{
    public static string New() => Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(8)).ToLowerInvariant();
    public static long Now() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
}
