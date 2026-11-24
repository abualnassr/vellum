using System.IO;
using Vellum.Models;
using Vellum.Services;
using Xunit;

namespace Vellum.Tests;

public class VellumServiceTests : IDisposable
{
    private readonly string _tempDir;

    public VellumServiceTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), $"vellum_tests_{Guid.NewGuid():N}");
        Directory.CreateDirectory(_tempDir);
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempDir))
        {
            Directory.Delete(_tempDir, recursive: true);
        }
    }

    [Fact]
    public void FileService_PreservesLineEndingsAndEncodingOnRoundtrip()
    {
        using var svc = new FileService();
        string lfPath = Path.Combine(_tempDir, "unix.md");
        string crlfPath = Path.Combine(_tempDir, "win.md");

        File.WriteAllText(lfPath, "# Hello\nWorld\n");
        var lfDoc = svc.ReadDocument(lfPath);
        Assert.Equal("LF", lfDoc.LineEnding);
        Assert.Equal("UTF-8", lfDoc.Encoding);

        svc.SaveDocument(lfPath, "# Hello\r\nUpdated\r\n", lfDoc.Encoding, lfDoc.LineEnding);
        string rawLf = File.ReadAllText(lfPath);
        Assert.DoesNotContain("\r\n", rawLf);
        Assert.Contains("Updated\n", rawLf);

        svc.SaveDocument(crlfPath, "# Title\nLine 2\n", "UTF-8 BOM", "CRLF");
        var crlfDoc = svc.ReadDocument(crlfPath);
        Assert.Equal("CRLF", crlfDoc.LineEnding);
        Assert.Equal("UTF-8 BOM", crlfDoc.Encoding);
    }

    [Fact]
    public void FileService_BuildDirectoryTree_FiltersSupportedFilesAndIgnoredFolders()
    {
        using var svc = new FileService();
        Directory.CreateDirectory(Path.Combine(_tempDir, "notes"));
        Directory.CreateDirectory(Path.Combine(_tempDir, "node_modules"));
        Directory.CreateDirectory(Path.Combine(_tempDir, "empty_folder"));

        File.WriteAllText(Path.Combine(_tempDir, "README.md"), "# Root");
        File.WriteAllText(Path.Combine(_tempDir, "notes", "design.mdx"), "# Design");
        File.WriteAllText(Path.Combine(_tempDir, "notes", "binary.exe"), "ignored");
        File.WriteAllText(Path.Combine(_tempDir, "node_modules", "pkg.md"), "# Ignored");

        var tree = svc.BuildDirectoryTree(_tempDir);
        Assert.NotNull(tree);
        Assert.NotNull(tree!.Children);
        Assert.Contains(tree.Children!, n => !n.IsDirectory && n.Name == "README.md");
        Assert.Contains(tree.Children!, n => n.IsDirectory && n.Name == "notes");
        Assert.DoesNotContain(tree.Children!, n => n.Name == "node_modules");
        Assert.DoesNotContain(tree.Children!, n => n.Name == "empty_folder");

        var notes = tree.Children!.Single(n => n.Name == "notes");
        Assert.Single(notes.Children!);
        Assert.Equal("design.mdx", notes.Children![0].Name);
    }

    [Theory]
    [InlineData("https://github.com/example", true)]
    [InlineData("http://localhost:3000", true)]
    [InlineData("mailto:user@example.com", true)]
    [InlineData("javascript:alert(1)", false)]
    [InlineData("file:///C:/docs/sample.txt", false)]
    [InlineData("custom-app:open", false)]
    public void FileService_IsSafeExternalUrl_ValidatesSchemeStrictly(string url, bool expected)
    {
        Assert.Equal(expected, FileService.IsSafeExternalUrl(url));
    }

    [Fact]
    public void SettingsService_SavesAndReloadsSettings()
    {
        string settingsPath = Path.Combine(_tempDir, "settings.json");
        var svc = new SettingsService(settingsPath);
        var input = new AppSettings
        {
            Theme = "paper",
            AccentColor = "#FFD400",
            ReadingFont = "serif",
            ReadingFontSize = 18,
            ReadingWidth = "wide",
            StartupView = "lastSession",
            StartupSidebar = true,
            StartupOutline = true,
            TextDirection = "rtl",
            SpellCheck = false,
            SpellCheckLanguage = "ar-SA",
            LastSessionFiles = new List<string> { @"C:\Docs\one.md", @"C:\Docs\two.md" },
            LastSessionActivePath = @"C:\Docs\two.md",
            RecentFiles = new List<string> { @"C:\Docs\one.md" },
        };

        svc.Save(input);
        var loaded = svc.Load();

        Assert.Equal("paper", loaded.Theme);
        Assert.Equal("#FFD400", loaded.AccentColor);
        Assert.Equal("serif", loaded.ReadingFont);
        Assert.Equal(18, loaded.ReadingFontSize);
        Assert.Equal("wide", loaded.ReadingWidth);
        Assert.Equal("lastSession", loaded.StartupView);
        Assert.True(loaded.StartupSidebar);
        Assert.True(loaded.StartupOutline);
        Assert.Equal("rtl", loaded.TextDirection);
        Assert.False(loaded.SpellCheck);
        Assert.Equal("ar-SA", loaded.SpellCheckLanguage);
        Assert.Equal(2, loaded.LastSessionFiles.Count);
        Assert.Equal(@"C:\Docs\two.md", loaded.LastSessionActivePath);
        Assert.Single(loaded.RecentFiles);
        Assert.Equal(@"C:\Docs\one.md", loaded.RecentFiles[0]);

        foreach (string theme in new[] { "snow", "charcoal", "sepia-dark", "nord", "oled" })
        {
            loaded.Theme = theme;
            svc.Save(loaded);
            Assert.Equal(theme, svc.Load().Theme);
        }
    }

    [Fact]
    public void SpellCheckService_MasksCodeMathUrlsAndPreservesExactIndices()
    {
        string md = string.Join("\n", new[]
        {
            "---",
            "title: teh frontmatter",
            "---",
            "Real prose wrd here.",
            "Inline `teh_code` and [link](https://exmple.com/bad) plus $x_1$ and `foo`.",
            "```ts",
            "const mispeled = 1;",
            "```",
            "Final line مرحبا.",
        });

        string masked = SpellCheckService.MaskMarkdownForSpellCheck(md);
        Assert.Equal(md.Length, masked.Length);
        Assert.DoesNotContain("frontmatter", masked);
        Assert.DoesNotContain("teh_code", masked);
        Assert.DoesNotContain("exmple", masked);
        Assert.DoesNotContain("mispeled", masked);

        int proseIdx = md.IndexOf("Real prose wrd here.", StringComparison.Ordinal);
        Assert.Equal("Real prose wrd here.", masked.Substring(proseIdx, "Real prose wrd here.".Length));
    }

    [Fact]
    public void SpellCheckService_ChecksBilingualEnglishAndArabicAndReturnsSuggestions()
    {
        using var svc = new SpellCheckService();
        var langs = svc.GetLanguages();
        Assert.NotEmpty(langs.Available);

        string md = "Helo world.\n\nمرحباا بالعالم\n\n`helo`";
        var issues = svc.CheckText(md, "auto");

        var heloIssue = issues.FirstOrDefault(i => i.Word == "Helo");
        Assert.NotNull(heloIssue);
        Assert.Equal(0, heloIssue!.Start);
        Assert.Contains("Hello", heloIssue.Suggestions);
        Assert.DoesNotContain(issues, i => i.Word == "helo");

        if (!string.IsNullOrEmpty(langs.ActiveArabic))
        {
            var arIssue = issues.FirstOrDefault(i => i.Word == "مرحباا");
            Assert.NotNull(arIssue);
            Assert.Equal(md.IndexOf("مرحباا", StringComparison.Ordinal), arIssue!.Start);
            Assert.NotEmpty(arIssue.Suggestions);
        }
    }

    [Theory]
    [InlineData("Vellum.Markdown", null, true)]
    [InlineData("Vellum.Markdown", "", true)]
    [InlineData("Vellum.Markdown", "Vellum.Markdown", true)]
    [InlineData("vellum.markdown", "VELLUM.MARKDOWN", true)]
    [InlineData("Vellum.Markdown", "MdView.md", false)]
    [InlineData("MdView.md", "Vellum.Markdown", false)]
    [InlineData(null, "Vellum.Markdown", false)]
    public void FileAssociationService_IsDefaultHandlerMatch_RequiresShellAndHkcuAgreement(
        string? effectiveProgId,
        string? hkcuClassDefault,
        bool expected)
    {
        Assert.Equal(expected, FileAssociationService.IsDefaultHandlerMatch(effectiveProgId, hkcuClassDefault));
    }

    [Theory]
    [InlineData(@"C:\images\photo.png", true)]
    [InlineData(@"C:\images\diagram.svg", true)]
    [InlineData(@"C:\docs\secret.txt", false)]
    [InlineData(@"C:\bin\payload.exe", false)]
    public void EmbeddedAssetServer_OnlyAllowsMediaExtensionsForLocalFiles(string path, bool expected)
    {
        Assert.Equal(expected, EmbeddedAssetServer.IsAllowedMediaExtension(path));
    }

    [Fact]
    public void EmbeddedAssetServer_ResolvesQueryAndMimeTypes()
    {
        Assert.Equal(@"C:\folder\my pic.png", EmbeddedAssetServer.ExtractQueryParam("?path=C%3A%5Cfolder%5Cmy%20pic.png", "path"));
        Assert.Equal("application/javascript; charset=utf-8", EmbeddedAssetServer.GetContentType("assets/app.js"));
        Assert.Equal("font/woff2", EmbeddedAssetServer.GetContentType("assets/inter.woff2"));
    }
}
