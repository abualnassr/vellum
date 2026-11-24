using System.Collections.Concurrent;
using System.IO;
using System.Text;
using Vellum.Models;

namespace Vellum.Services;

public sealed class FileService : IDisposable
{
    private static readonly HashSet<string> SupportedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".md", ".markdown", ".mdown", ".mkd", ".mkdn", ".mdx", ".txt"
    };

    private static readonly HashSet<string> IgnoredDirectories = new(StringComparer.OrdinalIgnoreCase)
    {
        ".git", "node_modules", "bin", "obj", ".vs", "dist", ".next", ".venv", "__pycache__"
    };

    private readonly ConcurrentDictionary<string, DateTime> _recentSelfWrites =
        new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, FileSystemWatcher> _watchers =
        new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, System.Timers.Timer> _debounceTimers =
        new(StringComparer.OrdinalIgnoreCase);
    private readonly HashSet<string> _watchedFiles = new(StringComparer.OrdinalIgnoreCase);
    private readonly object _watchLock = new();

    public event Action<string, string>? FileExternallyChanged;
    public event Action<string>? FileExternallyDeleted;

    public FileDocument ReadDocument(string path)
    {
        string fullPath = Path.GetFullPath(path);
        if (!File.Exists(fullPath))
        {
            throw new FileNotFoundException($"File not found: {fullPath}", fullPath);
        }

        byte[] bytes = File.ReadAllBytes(fullPath);
        bool hasUtf8Bom = bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF;
        string encodingName = hasUtf8Bom ? "UTF-8 BOM" : "UTF-8";
        string text = hasUtf8Bom
            ? Encoding.UTF8.GetString(bytes, 3, bytes.Length - 3)
            : Encoding.UTF8.GetString(bytes);

        string lineEnding = text.Contains("\r\n", StringComparison.Ordinal) ? "CRLF" : "LF";
        var info = new FileInfo(fullPath);

        WatchFile(fullPath);

        return new FileDocument
        {
            Path = fullPath,
            Name = info.Name,
            Content = text,
            Encoding = encodingName,
            LineEnding = lineEnding,
            LastModifiedUtc = info.LastWriteTimeUtc.ToString("O"),
            SizeBytes = info.Length,
            ReadOnly = info.IsReadOnly,
        };
    }

    public FileDocument SaveDocument(
        string path,
        string content,
        string encodingName = "UTF-8",
        string lineEnding = "CRLF"
    )
    {
        string fullPath = Path.GetFullPath(path);
        string? dir = Path.GetDirectoryName(fullPath);
        if (!string.IsNullOrEmpty(dir))
        {
            Directory.CreateDirectory(dir);
        }

        string normalized = content.Replace("\r\n", "\n").Replace("\r", "\n");
        if (string.Equals(lineEnding, "CRLF", StringComparison.OrdinalIgnoreCase))
        {
            normalized = normalized.Replace("\n", "\r\n");
        }

        bool emitBom = string.Equals(encodingName, "UTF-8 BOM", StringComparison.OrdinalIgnoreCase);
        var enc = new UTF8Encoding(encoderShouldEmitUTF8Identifier: emitBom);

        _recentSelfWrites[fullPath] = DateTime.UtcNow;
        File.WriteAllText(fullPath, normalized, enc);

        var info = new FileInfo(fullPath);
        WatchFile(fullPath);

        return new FileDocument
        {
            Path = fullPath,
            Name = info.Name,
            Content = normalized,
            Encoding = emitBom ? "UTF-8 BOM" : "UTF-8",
            LineEnding = lineEnding.Equals("LF", StringComparison.OrdinalIgnoreCase) ? "LF" : "CRLF",
            LastModifiedUtc = info.LastWriteTimeUtc.ToString("O"),
            SizeBytes = info.Length,
            ReadOnly = info.IsReadOnly,
        };
    }

    public DirectoryNode? BuildDirectoryTree(string folderPath, int maxDepth = 4)
    {
        if (string.IsNullOrWhiteSpace(folderPath) || !Directory.Exists(folderPath))
        {
            return null;
        }

        string fullRoot = Path.GetFullPath(folderPath);
        return ScanDir(fullRoot, 0, maxDepth);
    }

    private static DirectoryNode? ScanDir(string dirPath, int depth, int maxDepth)
    {
        var dirInfo = new DirectoryInfo(dirPath);
        var children = new List<DirectoryNode>();

        if (depth < maxDepth)
        {
            try
            {
                foreach (var sub in dirInfo.EnumerateDirectories().OrderBy(d => d.Name, StringComparer.OrdinalIgnoreCase))
                {
                    if ((sub.Attributes & FileAttributes.Hidden) != 0) continue;
                    if (IgnoredDirectories.Contains(sub.Name)) continue;

                    var subNode = ScanDir(sub.FullName, depth + 1, maxDepth);
                    if (subNode != null && (subNode.Children?.Count ?? 0) > 0)
                    {
                        children.Add(subNode);
                    }
                }
            }
            catch
            {
                // Skip inaccessible directories cleanly
            }
        }

        try
        {
            foreach (var file in dirInfo.EnumerateFiles().OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase))
            {
                if (!SupportedExtensions.Contains(file.Extension)) continue;
                children.Add(new DirectoryNode
                {
                    Name = file.Name,
                    Path = file.FullName,
                    IsDirectory = false,
                });
            }
        }
        catch
        {
            // Skip inaccessible files cleanly
        }

        if (depth > 0 && children.Count == 0) return null;

        return new DirectoryNode
        {
            Name = dirInfo.Name,
            Path = dirInfo.FullName,
            IsDirectory = true,
            Children = children,
        };
    }

    public static bool IsSafeExternalUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return false;
        if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri)) return false;
        return uri.Scheme.Equals("https", StringComparison.OrdinalIgnoreCase)
            || uri.Scheme.Equals("http", StringComparison.OrdinalIgnoreCase)
            || uri.Scheme.Equals("mailto", StringComparison.OrdinalIgnoreCase);
    }

    public static bool IsSupportedDocumentPath(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return false;
        string ext = Path.GetExtension(path);
        return SupportedExtensions.Contains(ext);
    }

    public void WatchFile(string fullPath)
    {
        string? dir = Path.GetDirectoryName(fullPath);
        if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir)) return;

        lock (_watchLock)
        {
            _watchedFiles.Add(fullPath);
            if (_watchers.ContainsKey(dir)) return;

            var watcher = new FileSystemWatcher(dir)
            {
                NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.FileName | NotifyFilters.Size,
                IncludeSubdirectories = false,
                EnableRaisingEvents = true,
            };

            watcher.Changed += (_, e) => OnWatchedEvent(e.FullPath, deleted: false);
            watcher.Created += (_, e) => OnWatchedEvent(e.FullPath, deleted: false);
            watcher.Deleted += (_, e) => OnWatchedEvent(e.FullPath, deleted: true);
            watcher.Renamed += (_, e) => OnWatchedEvent(e.OldFullPath, deleted: true);

            _watchers[dir] = watcher;
        }
    }

    private void OnWatchedEvent(string fullPath, bool deleted)
    {
        lock (_watchLock)
        {
            if (!_watchedFiles.Contains(fullPath)) return;
        }

        if (_recentSelfWrites.TryGetValue(fullPath, out var lastSelfWrite))
        {
            if ((DateTime.UtcNow - lastSelfWrite).TotalMilliseconds < 1500)
            {
                return;
            }
        }

        if (_debounceTimers.TryGetValue(fullPath, out var oldTimer))
        {
            oldTimer.Stop();
            oldTimer.Dispose();
        }

        var timer = new System.Timers.Timer(250) { AutoReset = false };
        timer.Elapsed += (_, _) =>
        {
            _debounceTimers.TryRemove(fullPath, out var _);
            timer.Dispose();

            if (deleted || !File.Exists(fullPath))
            {
                FileExternallyDeleted?.Invoke(fullPath);
            }
            else
            {
                var info = new FileInfo(fullPath);
                FileExternallyChanged?.Invoke(fullPath, info.LastWriteTimeUtc.ToString("O"));
            }
        };
        _debounceTimers[fullPath] = timer;
        timer.Start();
    }

    public void Dispose()
    {
        foreach (var w in _watchers.Values)
        {
            w.EnableRaisingEvents = false;
            w.Dispose();
        }
        _watchers.Clear();

        foreach (var t in _debounceTimers.Values)
        {
            t.Stop();
            t.Dispose();
        }
        _debounceTimers.Clear();
    }
}
