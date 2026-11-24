using System.Text.Json.Serialization;

namespace Vellum.Models;

public sealed class AppSettings
{
    public string Theme { get; set; } = "system";
    public string ReadingFont { get; set; } = "sans";
    public int ReadingFontSize { get; set; } = 16;
    public int EditorFontSize { get; set; } = 14;
    public string ReadingWidth { get; set; } = "comfortable";
    public string DefaultViewMode { get; set; } = "read";
    public string StartupView { get; set; } = "welcome";
    public bool StartupSidebar { get; set; } = false;
    public bool StartupOutline { get; set; } = false;
    public string TextDirection { get; set; } = "auto";
    public bool SpellCheck { get; set; } = true;
    public string SpellCheckLanguage { get; set; } = "auto";
    public bool WordWrap { get; set; } = true;
    public bool LineNumbers { get; set; } = true;
    public bool SyncScroll { get; set; } = true;
    public bool AutoSave { get; set; } = false;
    public double Zoom { get; set; } = 1.0;
    public double SplitRatio { get; set; } = 0.5;
    public List<string> RecentFiles { get; set; } = new();
    public string? LastOpenedFolder { get; set; }
    public List<string> LastSessionFiles { get; set; } = new();
    public string? LastSessionActivePath { get; set; }
    public WindowBounds? WindowBounds { get; set; }
}

public sealed class WindowBounds
{
    public double Left { get; set; }
    public double Top { get; set; }
    public double Width { get; set; } = 1180;
    public double Height { get; set; } = 780;
    public bool IsMaximized { get; set; }
}

public sealed class FileDocument
{
    public required string Path { get; init; }
    public required string Name { get; init; }
    public required string Content { get; init; }
    public required string Encoding { get; init; }
    public required string LineEnding { get; init; }
    public required string LastModifiedUtc { get; init; }
    public required long SizeBytes { get; init; }
    public required bool ReadOnly { get; init; }
}

public sealed class DirectoryNode
{
    public required string Name { get; init; }
    public required string Path { get; init; }
    public required bool IsDirectory { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<DirectoryNode>? Children { get; init; }
}

public sealed class AssocStatus
{
    public required bool IsRegistered { get; init; }
    public required bool IsDefaultForMd { get; init; }
    public required string ExecutablePath { get; init; }
}

public sealed class SpellIssue
{
    public required int Start { get; init; }
    public required int Length { get; init; }
    public required string Word { get; init; }
    public required string Language { get; init; }
    public required List<string> Suggestions { get; init; }
}

public sealed class SpellLanguagesInfo
{
    public required List<string> Available { get; init; }
    public string? ActiveEnglish { get; init; }
    public string? ActiveArabic { get; init; }
}
