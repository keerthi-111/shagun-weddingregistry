using System.Net;
using System.Net.Sockets;
using System.Text.RegularExpressions;

namespace Shagun.Api;

public record Preview(string Title, string Image, int Price, string Store);

/// Best-effort product details from a store link (Open Graph tags). Many stores (Amazon especially)
/// block server fetches, so the UI always lets the couple fill details in by hand.
public static partial class LinkPreview
{
    public const string ClientName = "preview";

    /// HttpClient whose every connection — including after redirects — refuses private/loopback addresses (SSRF guard).
    public static void AddPreviewClient(this IServiceCollection services) =>
        services.AddHttpClient(ClientName, c =>
        {
            c.Timeout = TimeSpan.FromSeconds(7);
            c.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36");
            c.DefaultRequestHeaders.AcceptLanguage.ParseAdd("en-IN,en;q=0.9");
        }).ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
        {
            MaxAutomaticRedirections = 5,
            ConnectCallback = async (ctx, ct) =>
            {
                var addrs = await Dns.GetHostAddressesAsync(ctx.DnsEndPoint.Host, ct);
                var ip = addrs.FirstOrDefault(IsPublic) ?? throw new HttpRequestException("That link is not reachable");
                var socket = new Socket(ip.AddressFamily, SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
                try { await socket.ConnectAsync(new IPEndPoint(ip, ctx.DnsEndPoint.Port), ct); return new NetworkStream(socket, true); }
                catch { socket.Dispose(); throw; }
            },
        });

    static bool IsPublic(IPAddress ip)
    {
        if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
        if (IPAddress.IsLoopback(ip)) return false;
        if (ip.AddressFamily == AddressFamily.InterNetwork)
        {
            var b = ip.GetAddressBytes();
            return !(b[0] == 10 || b[0] == 0 || (b[0] == 172 && b[1] >= 16 && b[1] <= 31) || (b[0] == 192 && b[1] == 168) || (b[0] == 169 && b[1] == 254) || (b[0] == 100 && b[1] >= 64 && b[1] <= 127));
        }
        return !(ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || ip.IsIPv6UniqueLocal);
    }

    public static async Task<Preview> FetchAsync(HttpClient http, string url, CancellationToken ct)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) throw new ArgumentException("That does not look like a link");
        if (uri.Scheme is not ("http" or "https")) throw new ArgumentException("Only http(s) links are supported");

        using var res = await http.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead, ct);
        var html = await ReadCapped(res, 600_000, ct);

        var title = Meta(html, "og:title", "twitter:title");
        if (title == "") title = WebUtility.HtmlDecode(TitleTag().Match(html).Groups[1].Value).Trim();
        var image = Meta(html, "og:image", "og:image:secure_url", "twitter:image");
        var priceText = Meta(html, "product:price:amount", "og:price:amount", "price");
        if (priceText == "") priceText = JsonPrice().Match(html).Groups[1].Value;
        int.TryParse(priceText.Replace(",", "").Split('.')[0], out var price);

        return new Preview(title.Length > 200 ? title[..200] : title, image, Math.Max(0, price), uri.Host.Replace("www.", ""));
    }

    static async Task<string> ReadCapped(HttpResponseMessage res, int max, CancellationToken ct)
    {
        await using var s = await res.Content.ReadAsStreamAsync(ct);
        using var reader = new StreamReader(s);
        var buf = new char[max];
        var n = await reader.ReadBlockAsync(buf.AsMemory(), ct);
        return new string(buf, 0, n);
    }

    static string Meta(string html, params string[] keys)
    {
        foreach (var k in keys)
        {
            var tag = Regex.Match(html, $@"<meta[^>]+(?:property|name|itemprop)=[""']{Regex.Escape(k)}[""'][^>]*>", RegexOptions.IgnoreCase).Value;
            var val = Regex.Match(tag, @"content=[""']([^""']*)[""']", RegexOptions.IgnoreCase).Groups[1].Value;
            if (val != "") return WebUtility.HtmlDecode(val).Trim();
        }
        return "";
    }

    [GeneratedRegex(@"<title[^>]*>([^<]*)</title>", RegexOptions.IgnoreCase)] private static partial Regex TitleTag();
    [GeneratedRegex(@"""price""\s*:\s*""?([\d,.]+)""?")] private static partial Regex JsonPrice();
}
