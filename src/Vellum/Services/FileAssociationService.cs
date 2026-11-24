using System.Diagnostics;
using System.IO;
using Microsoft.Win32;
using Vellum.Models;
using Vellum.Native;

namespace Vellum.Services;

public sealed class FileAssociationService
{
    private const string ProgId = "Vellum.Markdown";
    private const string AppSubKey = @"Software\Vellum";
    private static readonly string[] Extensions = { ".md", ".markdown", ".mdown", ".mkd", ".mdx" };

    public static string GetExecutablePath()
    {
        return Environment.ProcessPath
            ?? Process.GetCurrentProcess().MainModule?.FileName
            ?? Path.Combine(AppContext.BaseDirectory, "Vellum.exe");
    }

    /// <summary>
    /// Returns true only when both the resolved Windows Shell ProgId and per-user HKCU class default agree on Vellum.
    /// </summary>
    public static bool IsDefaultHandlerMatch(string? effectiveProgId, string? hkcuClassDefault)
    {
        if (!string.Equals(effectiveProgId, ProgId, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return string.IsNullOrWhiteSpace(hkcuClassDefault) ||
               string.Equals(hkcuClassDefault, ProgId, StringComparison.OrdinalIgnoreCase);
    }

    public AssocStatus GetStatus()
    {
        string exePath = GetExecutablePath();
        bool isRegistered = false;
        bool isDefault = false;

        try
        {
            using var cmdKey = Registry.CurrentUser.OpenSubKey($@"Software\Classes\{ProgId}\shell\open\command");
            if (cmdKey?.GetValue(null) is string val && !string.IsNullOrWhiteSpace(val))
            {
                isRegistered = true;
            }

            string? effectiveProgId = Win32Interop.QueryAssocProgId(".md");
            if (string.IsNullOrWhiteSpace(effectiveProgId))
            {
                using var latestKey = Registry.CurrentUser.OpenSubKey(
                    @"Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.md\UserChoiceLatest\ProgId"
                );
                effectiveProgId = latestKey?.GetValue("ProgId") as string;
            }
            if (string.IsNullOrWhiteSpace(effectiveProgId))
            {
                using var userChoice = Registry.CurrentUser.OpenSubKey(
                    @"Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.md\UserChoice"
                );
                effectiveProgId = userChoice?.GetValue("ProgId") as string;
            }

            using var extKey = Registry.CurrentUser.OpenSubKey(@"Software\Classes\.md");
            string? hkcuDefault = extKey?.GetValue(null) as string;

            isDefault = IsDefaultHandlerMatch(effectiveProgId, hkcuDefault);
        }
        catch
        {
            // Ignore registry read issues
        }

        return new AssocStatus
        {
            IsRegistered = isRegistered,
            IsDefaultForMd = isDefault,
            ExecutablePath = exePath,
        };
    }

    public AssocStatus Register()
    {
        string exePath = GetExecutablePath();
        string quotedExe = $"\"{exePath}\"";

        using (var progKey = Registry.CurrentUser.CreateSubKey($@"Software\Classes\{ProgId}"))
        {
            progKey.SetValue(null, "Markdown Document");
            progKey.SetValue("FriendlyTypeName", "Markdown Document");

            using var iconKey = progKey.CreateSubKey("DefaultIcon");
            iconKey.SetValue(null, $"{quotedExe},0");

            using var shellRoot = progKey.CreateSubKey("shell");
            shellRoot.SetValue(null, "open");

            using var openVerb = shellRoot.CreateSubKey("open");
            openVerb.SetValue(null, "Open with Vellum");

            using var cmdKey = openVerb.CreateSubKey("command");
            cmdKey.SetValue(null, $"{quotedExe} \"%1\"");
        }

        using (var appKey = Registry.CurrentUser.CreateSubKey(@"Software\Classes\Applications\Vellum.exe"))
        {
            appKey.SetValue("FriendlyAppName", "Vellum");
            using var cmdKey = appKey.CreateSubKey(@"shell\open\command");
            cmdKey.SetValue(null, $"{quotedExe} \"%1\"");

            using var supportedKey = appKey.CreateSubKey("SupportedTypes");
            foreach (string ext in Extensions)
            {
                supportedKey.SetValue(ext, "");
            }
        }

        foreach (string ext in Extensions)
        {
            using var extKey = Registry.CurrentUser.CreateSubKey($@"Software\Classes\{ext}");
            extKey.SetValue(null, ProgId);
            extKey.SetValue("PerceivedType", "text");
            extKey.SetValue("Content Type", "text/markdown");

            using var openWith = extKey.CreateSubKey("OpenWithProgids");
            openWith.SetValue(ProgId, Array.Empty<byte>(), RegistryValueKind.None);
        }

        using (var capKey = Registry.CurrentUser.CreateSubKey($@"{AppSubKey}\Capabilities"))
        {
            capKey.SetValue("ApplicationName", "Vellum");
            capKey.SetValue("ApplicationDescription", "Editorial Markdown Viewer and Editor");

            using var assocKey = capKey.CreateSubKey("FileAssociations");
            foreach (string ext in Extensions)
            {
                assocKey.SetValue(ext, ProgId);
            }
        }

        using (var regApps = Registry.CurrentUser.CreateSubKey(@"Software\RegisteredApplications"))
        {
            regApps.SetValue("Vellum", $@"{AppSubKey}\Capabilities");
        }

        Win32Interop.SHChangeNotify(Win32Interop.SHCNE_ASSOCCHANGED, Win32Interop.SHCNF_IDLIST, IntPtr.Zero, IntPtr.Zero);
        return GetStatus();
    }

    public AssocStatus Unregister()
    {
        try
        {
            Registry.CurrentUser.DeleteSubKeyTree($@"Software\Classes\{ProgId}", throwOnMissingSubKey: false);
            Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\Applications\Vellum.exe", throwOnMissingSubKey: false);
            Registry.CurrentUser.DeleteSubKeyTree(AppSubKey, throwOnMissingSubKey: false);

            using var regApps = Registry.CurrentUser.OpenSubKey(@"Software\RegisteredApplications", writable: true);
            regApps?.DeleteValue("Vellum", throwOnMissingValue: false);

            foreach (string ext in Extensions)
            {
                using (var extKey = Registry.CurrentUser.OpenSubKey($@"Software\Classes\{ext}", writable: true))
                {
                    if (extKey?.GetValue(null) is string currentDefault &&
                        currentDefault.Equals(ProgId, StringComparison.OrdinalIgnoreCase))
                    {
                        extKey.DeleteValue("", throwOnMissingValue: false);
                    }
                }

                using var openWith = Registry.CurrentUser.OpenSubKey(
                    $@"Software\Classes\{ext}\OpenWithProgids",
                    writable: true
                );
                openWith?.DeleteValue(ProgId, throwOnMissingValue: false);
            }

            Win32Interop.SHChangeNotify(Win32Interop.SHCNE_ASSOCCHANGED, Win32Interop.SHCNF_IDLIST, IntPtr.Zero, IntPtr.Zero);
        }
        catch
        {
            // Ignore partial cleanup failures
        }

        return GetStatus();
    }

    public void OpenWindowsDefaultApps()
    {
        Process.Start(new ProcessStartInfo("ms-settings:defaultapps")
        {
            UseShellExecute = true,
        });
    }
}
