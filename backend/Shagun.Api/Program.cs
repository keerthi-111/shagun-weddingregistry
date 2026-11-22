using System.Security.Claims;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Shagun.Api;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDb>(o => o.UseSqlite(builder.Configuration.GetConnectionString("Db") ?? "Data Source=shagun.db"));
builder.Services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddPreviewClient();
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.NumberHandling = JsonNumberHandling.AllowReadingFromString;
    o.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(o =>
{
    o.Cookie.Name = "sid";
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Lax;
    o.ExpireTimeSpan = TimeSpan.FromDays(30);
    o.SlidingExpiration = true;
    o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
});
builder.Services.AddAuthorization();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
    scope.ServiceProvider.GetRequiredService<AppDb>().Database.EnsureCreated();

app.UseDefaultFiles();
app.UseStaticFiles();   // serves the built React app from wwwroot in production
app.UseAuthentication();
app.UseAuthorization();

var api = app.MapGroup("/api");
string[] themes = ["marigold", "rani", "peacock", "mehendi"];
string[] itemTypes = ["product", "fund", "giftcard"];
var upiPattern = new Regex(@"^[\w.\-]{2,}@[a-zA-Z]{2,}$");

// ---------------- auth ----------------
api.MapPost("/signup", async (SignupReq req, AppDb db, IPasswordHasher<User> hasher, HttpContext ctx) =>
{
    var email = S(req.Email, 120).ToLowerInvariant();
    var name = S(req.Name, 80);
    var pw = S(req.Password);
    if (!email.Contains('@') || pw.Length < 6 || name == "")
        return Err(400, "Name, valid email and a 6+ character password are needed");
    if (await db.Users.AnyAsync(u => u.Email == email))
        return Err(409, "An account with this email exists — log in instead");

    var user = new User { Email = email, Name = name };
    user.PasswordHash = hasher.HashPassword(user, pw);
    db.Users.Add(user);
    await db.SaveChangesAsync();
    await SignIn(ctx, user);
    return Results.Ok(new { ok = true });
});

api.MapPost("/login", async (SignupReq req, AppDb db, IPasswordHasher<User> hasher, HttpContext ctx) =>
{
    var email = S(req.Email).ToLowerInvariant();
    var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
    if (user is null || hasher.VerifyHashedPassword(user, user.PasswordHash, S(req.Password)) == PasswordVerificationResult.Failed)
        return Err(401, "Email or password is wrong");
    await SignIn(ctx, user);
    return Results.Ok(new { ok = true });
});

api.MapPost("/logout", async (HttpContext ctx) =>
{
    await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    return Results.Ok(new { ok = true });
});

api.MapGet("/me", async (AppDb db, HttpContext ctx) =>
{
    var user = await CurrentUser(db, ctx);
    if (user is null) return Results.Ok(new { user = (object?)null });
    var reg = await db.Registries.FirstOrDefaultAsync(r => r.OwnerId == user.Id);
    return Results.Ok(new
    {
        user = new { user.Name, user.Email },
        registry = reg is null ? null : await RegistryView(db, reg, owner: true),
    });
});

// ---------------- couple: registry ----------------
api.MapMethods("/registry", ["POST", "PUT"], async (RegistryReq req, AppDb db, HttpContext ctx) =>
{
    var user = await CurrentUser(db, ctx);
    if (user is null) return Err(401, "Please log in");

    var p1 = S(req.Partner1, 60); var p2 = S(req.Partner2, 60);
    var upiId = S(req.UpiId, 80);
    if (p1 == "" || p2 == "") return Err(400, "Both names are needed");
    if (upiId != "" && !upiPattern.IsMatch(upiId)) return Err(400, "UPI ID should look like name@bank");

    var reg = await db.Registries.FirstOrDefaultAsync(r => r.OwnerId == user.Id);
    var isNew = reg is null;
    if (reg is null)
    {
        reg = new Registry { OwnerId = user.Id, Slug = await Slugify(db, $"{p1}-weds-{p2}") };
        db.Registries.Add(reg);
        // every Indian registry starts with a Shagun envelope
        db.Items.Add(new Item
        {
            RegistryId = reg.Id, Type = "fund", Title = "Shagun", SortOrder = 0,
            Description = "Send your blessings the traditional way — any amount, straight to our UPI.",
        });
    }
    reg.Partner1 = p1; reg.Partner2 = p2;
    reg.Date = S(req.Date, 20); reg.City = S(req.City, 60); reg.Venue = S(req.Venue, 120);
    reg.Note = S(req.Note, 1000); reg.Cover = S(req.Cover);
    reg.Theme = themes.Contains(req.Theme) ? req.Theme! : "marigold";
    reg.UpiId = upiId; reg.UpiName = S(req.UpiName, 80); reg.Address = S(req.Address);
    await db.SaveChangesAsync();
    return Results.Ok(await RegistryView(db, reg, owner: true));
});

// ---------------- couple: items ----------------
api.MapPost("/preview", async (UrlReq req, AppDb db, HttpContext ctx, IHttpClientFactory http, CancellationToken ct) =>
{
    if (await CurrentUser(db, ctx) is null) return Err(401, "Please log in");
    try { return Results.Ok(await LinkPreview.FetchAsync(http.CreateClient(LinkPreview.ClientName), S(req.Url, 2000), ct)); }
    catch (ArgumentException e) { return Results.Ok(new { error = e.Message }); }
    catch (TaskCanceledException) { return Results.Ok(new { error = "The store took too long — fill in the details yourself" }); }
    catch (HttpRequestException) { return Results.Ok(new { error = "Couldn't reach that link — fill in the details yourself" }); }
});

api.MapPost("/items", async (ItemReq req, AppDb db, HttpContext ctx) =>
{
    var reg = await OwnRegistry(db, ctx);
    if (reg is null) return Err(400, "Create your registry first");

    var item = new Item
    {
        RegistryId = reg.Id,
        Type = itemTypes.Contains(req.Type) ? req.Type! : "product",
        Title = S(req.Title, 200), Description = S(req.Description, 600),
        Url = S(req.Url, 2000), Image = S(req.Image, 2000), Store = S(req.Store, 80), Category = S(req.Category, 40),
        Price = Rs(req.Price), Qty = Math.Clamp(req.Qty ?? 1, 1, 50), Target = Rs(req.Target),
        MostWanted = req.MostWanted ?? false,
        SortOrder = (await db.Items.Where(i => i.RegistryId == reg.Id).MaxAsync(i => (int?)i.SortOrder) ?? 0) + 1,
    };
    if (item.Title == "") return Err(400, "Give the gift a name");
    if (item.Url != "" && !Regex.IsMatch(item.Url, "^https?://")) return Err(400, "Store link must start with http(s)://");
    db.Items.Add(item);
    await db.SaveChangesAsync();
    return Results.Ok(ItemView(item, []));
});

api.MapPut("/items/{id}", async (string id, ItemReq req, AppDb db, HttpContext ctx) =>
{
    var reg = await OwnRegistry(db, ctx);
    var item = await db.Items.FirstOrDefaultAsync(i => i.Id == id && i.RegistryId == (reg == null ? "" : reg.Id));
    if (item is null) return Err(404, "Not found");
    if (req.Title is not null) item.Title = S(req.Title, 200);
    if (req.Description is not null) item.Description = S(req.Description, 600);
    if (req.Url is not null) item.Url = S(req.Url, 2000);
    if (req.Image is not null) item.Image = S(req.Image, 2000);
    if (req.Store is not null) item.Store = S(req.Store, 80);
    if (req.Category is not null) item.Category = S(req.Category, 40);
    if (req.Price is not null) item.Price = Rs(req.Price);
    if (req.Target is not null) item.Target = Rs(req.Target);
    if (req.Qty is not null) item.Qty = Math.Clamp(req.Qty.Value, 1, 50);
    if (req.MostWanted is not null) item.MostWanted = req.MostWanted.Value;
    if (item.Title == "") return Err(400, "Give the gift a name");
    await db.SaveChangesAsync();
    return Results.Ok(ItemView(item, []));
});

api.MapDelete("/items/{id}", async (string id, AppDb db, HttpContext ctx) =>
{
    var reg = await OwnRegistry(db, ctx);
    var item = await db.Items.FirstOrDefaultAsync(i => i.Id == id && i.RegistryId == (reg == null ? "" : reg.Id));
    if (item is null) return Err(404, "Not found");
    db.Items.Remove(item);   // gifts already received are kept for the couple's records
    await db.SaveChangesAsync();
    return Results.Ok(new { ok = true });
});

api.MapPatch("/gifts/{id}", async (string id, GiftPatch req, AppDb db, HttpContext ctx) =>
{
    var reg = await OwnRegistry(db, ctx);
    var gift = await db.Gifts.FirstOrDefaultAsync(g => g.Id == id && g.RegistryId == (reg == null ? "" : reg.Id));
    if (gift is null) return Err(404, "Not found");
    if (req.Thanked is not null) gift.Thanked = req.Thanked.Value;
    if (req.Received is not null) gift.Received = req.Received.Value;
    await db.SaveChangesAsync();
    return Results.Ok(gift);
});

// ---------------- guests (no account) ----------------
api.MapGet("/r/{slug}", async (string slug, AppDb db) =>
{
    var reg = await db.Registries.FirstOrDefaultAsync(r => r.Slug == slug);
    return reg is null ? Err(404, "Registry not found") : Results.Ok(await RegistryView(db, reg, owner: false));
});

api.MapPost("/r/{slug}/gift", async (string slug, GuestGiftReq req, AppDb db) =>
{
    var reg = await db.Registries.FirstOrDefaultAsync(r => r.Slug == slug);
    var item = reg is null ? null : await db.Items.FirstOrDefaultAsync(i => i.Id == req.ItemId && i.RegistryId == reg.Id);
    if (reg is null || item is null) return Err(404, "Gift not found");
    var guestName = S(req.GuestName, 80);
    if (guestName == "") return Err(400, "Tell the couple who this is from");

    var gift = new Gift
    {
        RegistryId = reg.Id, ItemId = item.Id, ItemTitle = item.Title, GuestName = guestName,
        Phone = S(req.Phone, 20), Message = S(req.Message, 600),
    };

    await using var tx = await db.Database.BeginTransactionAsync();
    if (item.Type == "product")
    {
        var claimed = await db.Gifts.Where(g => g.ItemId == item.Id && g.Type == "purchase").SumAsync(g => g.Qty);
        if (claimed >= item.Qty) return Err(409, "Someone has already bought this one — pick another gift");
        gift.Type = "purchase"; gift.Qty = 1; gift.Amount = item.Price; gift.OrderRef = S(req.OrderRef, 80);
    }
    else
    {
        var amount = Rs(req.Amount);
        if (amount < 1) return Err(400, "Enter an amount");
        gift.Type = "contribution"; gift.Amount = amount; gift.UpiRef = S(req.UpiRef, 40);
    }
    db.Gifts.Add(gift);
    await db.SaveChangesAsync();
    await tx.CommitAsync();

    // the delivery address is only revealed to a guest who has reserved a product
    return Results.Ok(new { ok = true, address = gift.Type == "purchase" ? reg.Address : null });
});

api.MapFallback(() => Err(404, "Unknown endpoint"));
app.MapFallbackToFile("index.html");   // React Router handles /app, /login, /r/:slug

app.Run();

// ---------------- helpers ----------------
static IResult Err(int status, string message) => Results.Json(new { error = message }, statusCode: status);

static string S(string? v, int max = 500)
{
    var t = (v ?? "").Trim();
    return t.Length > max ? t[..max] : t;
}

static int Rs(int? v) => Math.Max(0, v ?? 0);

static async Task SignIn(HttpContext ctx, User user)
{
    var identity = new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, user.Id) }, CookieAuthenticationDefaults.AuthenticationScheme);
    await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity),
        new AuthenticationProperties { IsPersistent = true });
}

static async Task<User?> CurrentUser(AppDb db, HttpContext ctx)
{
    var id = ctx.User.FindFirstValue(ClaimTypes.NameIdentifier);
    return id is null ? null : await db.Users.FindAsync(id);
}

static async Task<Registry?> OwnRegistry(AppDb db, HttpContext ctx)
{
    var user = await CurrentUser(db, ctx);
    return user is null ? null : await db.Registries.FirstOrDefaultAsync(r => r.OwnerId == user.Id);
}

static async Task<string> Slugify(AppDb db, string s)
{
    var b = Regex.Replace(s.ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-');
    if (b.Length > 40) b = b[..40];
    if (b == "") b = "registry";
    var slug = b;
    for (var n = 2; await db.Registries.AnyAsync(r => r.Slug == slug); n++) slug = $"{b}-{n}";
    return slug;
}

static object ItemView(Item i, IEnumerable<Gift> gifts)
{
    var gs = gifts.ToList();
    return new
    {
        i.Id, i.Type, i.Title, i.Description, i.Url, i.Image, i.Store, i.Category,
        i.Price, i.Qty, i.Target, i.MostWanted, Order = i.SortOrder, i.CreatedAt,
        Raised = gs.Sum(g => g.Amount),
        Claimed = gs.Where(g => g.Type == "purchase").Sum(g => g.Qty),
        Contributors = gs.Count,
    };
}

static async Task<object> RegistryView(AppDb db, Registry reg, bool owner)
{
    var items = await db.Items.Where(i => i.RegistryId == reg.Id).OrderBy(i => i.SortOrder).ToListAsync();
    var gifts = await db.Gifts.Where(g => g.RegistryId == reg.Id).OrderByDescending(g => g.CreatedAt).ToListAsync();
    return new
    {
        reg.Id, reg.Slug, reg.Partner1, reg.Partner2, reg.Date, reg.City, reg.Venue, reg.Note, reg.Cover, reg.Theme,
        reg.UpiId, reg.UpiName, reg.CreatedAt,
        Address = owner ? reg.Address : null,   // never sent to guests
        Items = items.Select(i => ItemView(i, gifts.Where(g => g.ItemId == i.Id))),
        Gifts = owner ? gifts : null,
    };
}

record SignupReq(string? Name, string? Email, string? Password);
record RegistryReq(string? Partner1, string? Partner2, string? Date, string? City, string? Venue, string? Note,
    string? Cover, string? Theme, string? UpiId, string? UpiName, string? Address);
record UrlReq(string? Url);
record ItemReq(string? Type, string? Title, string? Description, string? Url, string? Image, string? Store,
    string? Category, int? Price, int? Qty, int? Target, bool? MostWanted);
record GiftPatch(bool? Thanked, bool? Received);
record GuestGiftReq(string? ItemId, string? GuestName, string? Phone, string? Message, string? OrderRef, string? UpiRef, int? Amount);
