using System.IO;
using System.Reflection;
using Microsoft.Web.WebView2.Core;

namespace Vellum.Services;

public sealed class EmbeddedAssetServer
{
    public const string AppOrigin = "https://vellum.app";
    public const string LocalMediaOrigin = "https://vellum.local";
    private const string ResourcePrefix = "Vellum.wwwroot/";

    private static readonly HashSet<string> AllowedMediaExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico", ".avif", ".mp4", ".webm"
    };

    private static readonly Dictionary<string, string> MimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".html"] = "text/html; charset=utf-8",
        [".js"] = "application/javascript; charset=utf-8",
        [".mjs"] = "application/javascript; charset=utf-8",
        [".css"] = "text/css; charset=utf-8",
        [".svg"] = "image/svg+xml",
        [".woff2"] = "font/woff2",
        [".woff"] = "font/woff",
        [".ttf"] = "font/ttf",
        [".json"] = "application/json; charset=utf-8",
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".gif"] = "image/gif",
        [".webp"] = "image/webp",
        [".bmp"] = "image/bmp",
        [".ico"] = "image/x-icon",
        [".avif"] = "image/avif",
        [".mp4"] = "video/mp4",
        [".webm"] = "video/webm",
    };

    private readonly Assembly _assembly;
    private readonly Dictionary<string, string> _resourceMap = new(StringComparer.OrdinalIgnoreCase);

    public EmbeddedAssetServer(Assembly? assembly = null)
    {
        _assembly = assembly ?? Assembly.GetExecutingAssembly();
        foreach (string resName in _assembly.GetManifestResourceNames())
        {
            string normalized = resName.Replace('\\', '/');
            if (normalized.StartsWith(ResourcePrefix, StringComparison.OrdinalIgnoreCase))
            {
                string relPath = normalized[ResourcePrefix.Length..].TrimStart('/');
                _resourceMap[relPath] = resName;
            }
        }
    }

    public static string GetContentType(string path)
    {
        string ext = Path.GetExtension(path);
        return MimeTypes.TryGetValue(ext, out string? mime)
            ? mime
            : "application/octet-stream";
    }

    public static bool IsAllowedMediaExtension(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return false;
        return AllowedMediaExtensions.Contains(Path.GetExtension(path));
    }

    public static string? ExtractQueryParam(string rawQuery, string key)
    {
        if (string.IsNullOrWhiteSpace(rawQuery)) return null;
        string trimmed = rawQuery.TrimStart('?');
        foreach (string pair in trimmed.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            int eq = pair.IndexOf('=');
            if (eq <= 0) continue;
            string k = Uri.UnescapeDataString(pair[..eq]);
            if (string.Equals(k, key, StringComparison.OrdinalIgnoreCase))
            {
                return Uri.UnescapeDataString(pair[(eq + 1)..]);
            }
        }
        return null;
    }

    public void Attach(CoreWebView2 coreWebView)
    {
        coreWebView.AddWebResourceRequestedFilter($"{AppOrigin}/*", CoreWebView2WebResourceContext.All);
        coreWebView.AddWebResourceRequestedFilter($"{LocalMediaOrigin}/*", CoreWebView2WebResourceContext.All);
        coreWebView.WebResourceRequested += OnWebResourceRequested;
    }

    private void OnWebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
    {
        if (sender is not CoreWebView2 coreWebView) return;
        if (!Uri.TryCreate(e.Request.Uri, UriKind.Absolute, out var uri)) return;

        string origin = $"{uri.Scheme}://{uri.Authority}";

        if (origin.Equals(AppOrigin, StringComparison.OrdinalIgnoreCase))
        {
            string relPath = uri.AbsolutePath.TrimStart('/');
            if (string.IsNullOrEmpty(relPath)) relPath = "index.html";

            if (!_resourceMap.TryGetValue(relPath, out string? manifestName))
            {
                if (!relPath.Contains('.'))
                {
                    _resourceMap.TryGetValue("index.html", out manifestName);
                    relPath = "index.html";
                }
            }

            if (manifestName is null)
            {
                e.Response = coreWebView.Environment.CreateWebResourceResponse(
                    null, 404, "Not Found", "Content-Type: text/plain"
                );
                return;
            }

            using Stream? resStream = _assembly.GetManifestResourceStream(manifestName);
            if (resStream is null)
            {
                e.Response = coreWebView.Environment.CreateWebResourceResponse(
                    null, 404, "Not Found", "Content-Type: text/plain"
                );
                return;
            }

            var ms = new MemoryStream();
            resStream.CopyTo(ms);
            ms.Position = 0;

            string mime = GetContentType(relPath);
            string cache = relPath.StartsWith("assets/", StringComparison.OrdinalIgnoreCase)
                ? "Cache-Control: public, max-age=31536000, immutable"
                : "Cache-Control: no-cache";

            e.Response = coreWebView.Environment.CreateWebResourceResponse(
                ms, 200, "OK", $"Content-Type: {mime}\r\n{cache}"
            );
            return;
        }

        if (origin.Equals(LocalMediaOrigin, StringComparison.OrdinalIgnoreCase))
        {
            string? filePath = ExtractQueryParam(uri.Query, "path");
            if (string.IsNullOrWhiteSpace(filePath) || !IsAllowedMediaExtension(filePath))
            {
                e.Response = coreWebView.Environment.CreateWebResourceResponse(
                    null, 403, "Forbidden", "Content-Type: text/plain"
                );
                return;
            }

            if (!File.Exists(filePath))
            {
                e.Response = coreWebView.Environment.CreateWebResourceResponse(
                    null, 404, "Not Found", "Content-Type: text/plain"
                );
                return;
            }

            byte[] bytes = File.ReadAllBytes(filePath);
            var ms = new MemoryStream(bytes);
            string mime = GetContentType(filePath);

            e.Response = coreWebView.Environment.CreateWebResourceResponse(
                ms, 200, "OK", $"Content-Type: {mime}\r\nCache-Control: no-store"
            );
        }
    }
}
