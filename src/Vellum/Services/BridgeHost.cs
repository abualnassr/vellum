using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using Vellum.Models;

namespace Vellum.Services;

public sealed class BridgeHost
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private readonly MainWindow _window;
    private readonly CoreWebView2 _coreWebView;
    private readonly FileService _fileService;
    private readonly SettingsService _settingsService;
    private readonly FileAssociationService _assocService;
    private readonly SpellCheckService _spellCheckService;
    private readonly IReadOnlyList<string> _initialFiles;

    public BridgeHost(
        MainWindow window,
        CoreWebView2 coreWebView,
        FileService fileService,
        SettingsService settingsService,
        FileAssociationService assocService,
        SpellCheckService spellCheckService,
        IReadOnlyList<string> initialFiles
    )
    {
        _window = window;
        _coreWebView = coreWebView;
        _fileService = fileService;
        _settingsService = settingsService;
        _assocService = assocService;
        _spellCheckService = spellCheckService;
        _initialFiles = initialFiles;

        _coreWebView.WebMessageReceived += OnWebMessageReceived;
        _fileService.FileExternallyChanged += OnFileExternallyChanged;
        _fileService.FileExternallyDeleted += OnFileExternallyDeleted;
    }

    public void SendEvent(string eventName, object payload)
    {
        string json = JsonSerializer.Serialize(new { @event = eventName, payload }, JsonOpts);
        _window.Dispatcher.InvokeAsync(() =>
        {
            _coreWebView.PostWebMessageAsJson(json);
        });
    }

    public void OpenFilesInUi(IEnumerable<string> paths)
    {
        foreach (string p in paths)
        {
            if (string.IsNullOrWhiteSpace(p)) continue;
            try
            {
                var doc = _fileService.ReadDocument(p);
                SendEvent("file:open", doc);
            }
            catch (Exception ex)
            {
                SendEvent("app:error", new { message = $"Unable to open {Path.GetFileName(p)}: {ex.Message}" });
            }
        }
    }

    private void OnFileExternallyChanged(string path, string lastModifiedUtc)
    {
        SendEvent("file:externalChanged", new { path, lastModifiedUtc });
    }

    private void OnFileExternallyDeleted(string path)
    {
        SendEvent("file:externalDeleted", new { path });
    }

    private async void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        string raw = e.WebMessageAsJson;
        if (string.IsNullOrWhiteSpace(raw)) return;

        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;

        // Handle dropped native Explorer files via AdditionalObjects
        if (root.TryGetProperty("event", out var evtEl) &&
            evtEl.GetString() == "ui:filesDropped")
        {
            var dropped = new List<string>();
            if (e.AdditionalObjects != null)
            {
                foreach (object obj in e.AdditionalObjects)
                {
                    if (obj is CoreWebView2File file && FileService.IsSupportedDocumentPath(file.Path))
                    {
                        dropped.Add(file.Path);
                    }
                }
            }
            if (dropped.Count > 0)
            {
                OpenFilesInUi(dropped);
            }
            else
            {
                SendEvent("app:error", new { message = "Drop .md, .markdown, or .txt files to open them." });
            }
            return;
        }

        if (!root.TryGetProperty("id", out var idEl) || !root.TryGetProperty("method", out var methodEl))
        {
            return;
        }

        string id = idEl.GetString() ?? "";
        string method = methodEl.GetString() ?? "";
        JsonElement paramsEl = root.TryGetProperty("params", out var pEl) ? pEl : default;

        try
        {
            object? result = await DispatchAsync(method, paramsEl);
            SendResponse(id, ok: true, result: result, error: null);
        }
        catch (Exception ex)
        {
            SendResponse(id, ok: false, result: null, error: ex.Message);
        }
    }

    private void SendResponse(string id, bool ok, object? result, string? error)
    {
        string json = JsonSerializer.Serialize(new { id, ok, result, error }, JsonOpts);
        _window.Dispatcher.InvokeAsync(() =>
        {
            _coreWebView.PostWebMessageAsJson(json);
        });
    }

    private async Task<object?> DispatchAsync(string method, JsonElement p)
    {
        switch (method)
        {
            case "app:ready":
            {
                var settings = _settingsService.Load();
                var docs = new List<FileDocument>();
                string? activeSessionPath = null;

                if (_initialFiles.Count > 0)
                {
                    foreach (string path in _initialFiles)
                    {
                        try
                        {
                            if (File.Exists(path)) docs.Add(_fileService.ReadDocument(path));
                        }
                        catch
                        {
                            // Skip unreadable startup arg
                        }
                    }
                }
                else if (string.Equals(settings.StartupView, "lastSession", StringComparison.OrdinalIgnoreCase) &&
                         settings.LastSessionFiles.Count > 0)
                {
                    foreach (string path in settings.LastSessionFiles)
                    {
                        try
                        {
                            if (File.Exists(path)) docs.Add(_fileService.ReadDocument(path));
                        }
                        catch
                        {
                            // Skip missing session file
                        }
                    }
                    activeSessionPath = settings.LastSessionActivePath;
                }

                bool isMax = await _window.Dispatcher.InvokeAsync(
                    () => _window.WindowState == WindowState.Maximized
                );

                return new
                {
                    settings,
                    initialFiles = docs,
                    activeSessionPath,
                    isMaximized = isMax,
                    version = "1.0.1",
                };
            }

            case "app:setDirtyState":
            {
                int dirtyCount = GetInt(p, "dirtyCount", 0);
                _window.SetDirtyCount(dirtyCount);
                return true;
            }

            case "app:confirmClose":
            {
                await _window.Dispatcher.InvokeAsync(() => _window.ForceCloseApproved());
                return true;
            }

            case "window:drag":
            {
                await _window.Dispatcher.InvokeAsync(() => _window.BeginNativeDrag());
                return true;
            }

            case "window:minimize":
            {
                await _window.Dispatcher.InvokeAsync(() => _window.WindowState = WindowState.Minimized);
                return true;
            }

            case "window:toggleMaximize":
            {
                return await _window.Dispatcher.InvokeAsync(() => _window.ToggleMaximize());
            }

            case "window:close":
            {
                await _window.Dispatcher.InvokeAsync(() => _window.Close());
                return true;
            }

            case "settings:get":
                return _settingsService.Load();

            case "settings:save":
            {
                var incoming = JsonSerializer.Deserialize<AppSettings>(p.GetRawText(), JsonOpts)
                    ?? new AppSettings();
                var existing = _settingsService.Load();
                incoming.WindowBounds = existing.WindowBounds;
                var saved = _settingsService.Save(incoming);
                await _window.Dispatcher.InvokeAsync(() => _window.ApplyRuntimeTheme(saved.Theme));
                return saved;
            }

            case "file:read":
            {
                string path = GetString(p, "path");
                return _fileService.ReadDocument(path);
            }

            case "file:save":
            {
                string path = GetString(p, "path");
                string content = GetString(p, "content");
                string encoding = GetString(p, "encoding", "UTF-8");
                string lineEnding = GetString(p, "lineEnding", "CRLF");
                return _fileService.SaveDocument(path, content, encoding, lineEnding);
            }

            case "file:saveAs":
            {
                string suggested = GetString(p, "suggestedName", "Untitled.md");
                string content = GetString(p, "content");
                string lineEnding = GetString(p, "lineEnding", "CRLF");

                string? picked = await _window.Dispatcher.InvokeAsync(() =>
                {
                    var dlg = new SaveFileDialog
                    {
                        Title = "Save Markdown File",
                        FileName = suggested,
                        Filter = "Markdown Files (*.md;*.markdown;*.mdx)|*.md;*.markdown;*.mdx|Text Files (*.txt)|*.txt|All Files (*.*)|*.*",
                        DefaultExt = ".md",
                    };
                    return dlg.ShowDialog(_window) == true ? dlg.FileName : null;
                });

                if (string.IsNullOrEmpty(picked)) return null;
                return _fileService.SaveDocument(picked, content, "UTF-8", lineEnding);
            }

            case "file:openDialog":
            {
                string[]? picked = await _window.Dispatcher.InvokeAsync(() =>
                {
                    var dlg = new OpenFileDialog
                    {
                        Title = "Open Markdown File",
                        Multiselect = true,
                        Filter = "Markdown Files (*.md;*.markdown;*.mdown;*.mkd;*.mdx)|*.md;*.markdown;*.mdown;*.mkd;*.mdx|Text & All Files (*.*)|*.*",
                    };
                    return dlg.ShowDialog(_window) == true ? dlg.FileNames : null;
                });

                var list = new List<FileDocument>();
                if (picked != null)
                {
                    foreach (string path in picked)
                    {
                        list.Add(_fileService.ReadDocument(path));
                    }
                }
                return list;
            }

            case "file:openFolderDialog":
            {
                string? folder = await _window.Dispatcher.InvokeAsync(() =>
                {
                    var dlg = new OpenFolderDialog
                    {
                        Title = "Open Markdown Folder",
                        Multiselect = false,
                    };
                    return dlg.ShowDialog(_window) == true ? dlg.FolderName : null;
                });

                return string.IsNullOrEmpty(folder) ? null : _fileService.BuildDirectoryTree(folder);
            }

            case "file:listDirectory":
            {
                string folder = GetString(p, "path");
                return _fileService.BuildDirectoryTree(folder);
            }

            case "file:createInFolder":
            {
                string folder = GetString(p, "folderPath");
                string fileName = Path.GetFileName(GetString(p, "fileName", "Note.md"));
                if (string.IsNullOrWhiteSpace(fileName)) fileName = "Note.md";
                string target = Path.Combine(folder, fileName);
                int idx = 1;
                while (File.Exists(target))
                {
                    string stem = Path.GetFileNameWithoutExtension(fileName);
                    string ext = Path.GetExtension(fileName);
                    target = Path.Combine(folder, $"{stem} ({idx++}){ext}");
                }
                string title = Path.GetFileNameWithoutExtension(target);
                return _fileService.SaveDocument(target, $"# {title}\n\n");
            }

            case "file:revealInExplorer":
            {
                string path = GetString(p, "path");
                if (File.Exists(path))
                {
                    Process.Start(new ProcessStartInfo("explorer.exe", $"/select,\"{path}\"")
                    {
                        UseShellExecute = true,
                    });
                }
                return true;
            }

            case "file:openExternalUrl":
            {
                string url = GetString(p, "url");
                if (FileService.IsSafeExternalUrl(url))
                {
                    Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
                }
                return true;
            }

            case "export:pdf":
            {
                string suggested = GetString(p, "suggestedName", "document.pdf");
                string? savePath = await _window.Dispatcher.InvokeAsync(() =>
                {
                    var dlg = new SaveFileDialog
                    {
                        Title = "Export Styled PDF",
                        FileName = suggested,
                        Filter = "PDF Document (*.pdf)|*.pdf",
                        DefaultExt = ".pdf",
                    };
                    return dlg.ShowDialog(_window) == true ? dlg.FileName : null;
                });

                if (string.IsNullOrEmpty(savePath))
                {
                    return new { saved = false };
                }

                bool ok = await await _window.Dispatcher.InvokeAsync(async () =>
                {
                    var printSettings = _coreWebView.Environment.CreatePrintSettings();
                    printSettings.ShouldPrintBackgrounds = true;
                    printSettings.ShouldPrintHeaderAndFooter = false;
                    printSettings.MarginTop = 0.45;
                    printSettings.MarginBottom = 0.45;
                    printSettings.MarginLeft = 0.55;
                    printSettings.MarginRight = 0.55;
                    return await _coreWebView.PrintToPdfAsync(savePath, printSettings);
                });

                return new { saved = ok, path = savePath };
            }

            case "export:html":
            {
                string suggested = GetString(p, "suggestedName", "document.html");
                string html = GetString(p, "html");
                string? savePath = await _window.Dispatcher.InvokeAsync(() =>
                {
                    var dlg = new SaveFileDialog
                    {
                        Title = "Export Standalone HTML",
                        FileName = suggested,
                        Filter = "HTML Document (*.html)|*.html",
                        DefaultExt = ".html",
                    };
                    return dlg.ShowDialog(_window) == true ? dlg.FileName : null;
                });

                if (string.IsNullOrEmpty(savePath))
                {
                    return new { saved = false };
                }

                File.WriteAllText(savePath, html);
                return new { saved = true, path = savePath };
            }

            case "assoc:getStatus":
                return _assocService.GetStatus();

            case "assoc:register":
                return _assocService.Register();

            case "assoc:unregister":
                return _assocService.Unregister();

            case "assoc:openDefaultApps":
                _assocService.OpenWindowsDefaultApps();
                return true;

            case "spell:getLanguages":
                return _spellCheckService.GetLanguages();

            case "spell:check":
            {
                string text = GetString(p, "text");
                string language = GetString(p, "language", "auto");
                return await Task.Run(() => _spellCheckService.CheckText(text, language));
            }

            case "spell:addToDictionary":
            {
                string word = GetString(p, "word");
                string language = GetString(p, "language", "auto");
                _spellCheckService.AddToDictionary(word, language);
                return true;
            }

            case "spell:ignore":
            {
                string word = GetString(p, "word");
                string language = GetString(p, "language", "auto");
                _spellCheckService.IgnoreWord(word, language);
                return true;
            }

            default:
                throw new InvalidOperationException($"Unknown bridge method: {method}");
        }
    }

    private static string GetString(JsonElement p, string name, string fallback = "")
    {
        if (p.ValueKind == JsonValueKind.Object && p.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.String)
        {
            return el.GetString() ?? fallback;
        }
        return fallback;
    }

    private static int GetInt(JsonElement p, string name, int fallback = 0)
    {
        if (p.ValueKind == JsonValueKind.Object && p.TryGetProperty(name, out var el) && el.TryGetInt32(out int val))
        {
            return val;
        }
        return fallback;
    }
}
