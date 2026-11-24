using System.ComponentModel;
using System.IO;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using Vellum.Models;
using Vellum.Native;
using Vellum.Services;

namespace Vellum;

public partial class MainWindow : Window
{
    private readonly SettingsService _settingsService;
    private readonly FileService _fileService;
    private readonly FileAssociationService _assocService;
    private readonly SpellCheckService _spellCheckService;
    private readonly EmbeddedAssetServer _assetServer;
    private readonly IReadOnlyList<string> _initialFiles;

    private BridgeHost? _bridgeHost;
    private int _dirtyCount;
    private bool _forceClosing;
    private bool _isDarkInitial;

    public MainWindow(
        SettingsService settingsService,
        FileService fileService,
        FileAssociationService assocService,
        SpellCheckService spellCheckService,
        IReadOnlyList<string> initialFiles
    )
    {
        _settingsService = settingsService;
        _fileService = fileService;
        _assocService = assocService;
        _spellCheckService = spellCheckService;
        _initialFiles = initialFiles;
        _assetServer = new EmbeddedAssetServer();

        var settings = _settingsService.Load();
        ApplyPreShowTheme(settings.Theme);

        InitializeComponent();
        RestoreWindowBounds(settings.WindowBounds);

        StateChanged += OnWindowStateChanged;
        Closing += OnWindowClosing;
        Loaded += OnWindowLoaded;
    }

    private static (bool IsDark, byte R, byte G, byte B) ResolveThemeChrome(string? theme)
    {
        return theme switch
        {
            "light" => (false, 0xFA, 0xF9, 0xF6),
            "paper" => (false, 0xF6, 0xF0, 0xE6),
            "snow" => (false, 0xF8, 0xFA, 0xFC),
            "dark" => (true, 0x11, 0x13, 0x18),
            "charcoal" => (true, 0x1E, 0x1E, 0x1E),
            "sepia-dark" => (true, 0x1F, 0x1D, 0x1A),
            "nord" => (true, 0x2E, 0x34, 0x40),
            "oled" => (true, 0x00, 0x00, 0x00),
            _ => IsSystemDarkMode()
                ? (true, (byte)0x11, (byte)0x13, (byte)0x18)
                : (false, (byte)0xFA, (byte)0xF9, (byte)0xF6),
        };
    }

    private void ApplyPreShowTheme(string theme)
    {
        var (isDark, r, g, b) = ResolveThemeChrome(theme);
        _isDarkInitial = isDark;
        Background = new SolidColorBrush(Color.FromRgb(r, g, b));
    }

    public void ApplyRuntimeTheme(string theme)
    {
        var (isDark, r, g, b) = ResolveThemeChrome(theme);
        _isDarkInitial = isDark;
        Background = new SolidColorBrush(Color.FromRgb(r, g, b));

        if (WebView?.CoreWebView2 != null)
        {
            WebView.DefaultBackgroundColor = System.Drawing.Color.FromArgb(255, r, g, b);
        }

        IntPtr hwnd = new WindowInteropHelper(this).Handle;
        Win32Interop.ApplyWindowFrameAttributes(hwnd, isDark);
    }

    private static bool IsSystemDarkMode()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(
                @"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"
            );
            object? val = key?.GetValue("AppsUseLightTheme");
            return val is int i && i == 0;
        }
        catch
        {
            return false;
        }
    }

    private void RestoreWindowBounds(WindowBounds? bounds)
    {
        if (bounds == null) return;

        double w = Math.Max(680, bounds.Width);
        double h = Math.Max(460, bounds.Height);
        double left = bounds.Left;
        double top = bounds.Top;

        double vLeft = SystemParameters.VirtualScreenLeft;
        double vTop = SystemParameters.VirtualScreenTop;
        double vWidth = SystemParameters.VirtualScreenWidth;
        double vHeight = SystemParameters.VirtualScreenHeight;

        if (left + w >= vLeft + 80 &&
            left <= vLeft + vWidth - 80 &&
            top + h >= vTop + 80 &&
            top <= vTop + vHeight - 80)
        {
            WindowStartupLocation = WindowStartupLocation.Manual;
            Left = left;
            Top = top;
        }

        Width = w;
        Height = h;

        if (bounds.IsMaximized)
        {
            WindowState = WindowState.Maximized;
        }
    }

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);
        IntPtr hwnd = new WindowInteropHelper(this).Handle;
        Win32Interop.ApplyWindowFrameAttributes(hwnd, _isDarkInitial);

        var source = HwndSource.FromHwnd(hwnd);
        source?.AddHook(WndProc);
    }

    private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (msg == Win32Interop.WM_GETMINMAXINFO)
        {
            Win32Interop.HandleWmGetMinMaxInfo(hwnd, lParam);
            handled = true;
        }
        return IntPtr.Zero;
    }

    private async void OnWindowLoaded(object sender, RoutedEventArgs e)
    {
        try
        {
            var settings = _settingsService.Load();
            var (_, r, g, b) = ResolveThemeChrome(settings.Theme);
            WebView.DefaultBackgroundColor = System.Drawing.Color.FromArgb(255, r, g, b);

            string userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Vellum",
                "WebView2"
            );
            Directory.CreateDirectory(userDataFolder);

            var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
            await WebView.EnsureCoreWebView2Async(env);

            var core = WebView.CoreWebView2;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreBrowserAcceleratorKeysEnabled = false;
            core.Settings.IsZoomControlEnabled = false;
#if DEBUG
            core.Settings.AreDevToolsEnabled = true;
#else
            core.Settings.AreDevToolsEnabled = false;
#endif

            _assetServer.Attach(core);

            _bridgeHost = new BridgeHost(
                this,
                core,
                _fileService,
                _settingsService,
                _assocService,
                _spellCheckService,
                _initialFiles
            );

            core.NavigationStarting += (_, navArgs) =>
            {
                if (!Uri.TryCreate(navArgs.Uri, UriKind.Absolute, out var uri)) return;

                if (uri.Scheme.Equals("https", StringComparison.OrdinalIgnoreCase) &&
                    uri.Host.Equals("vellum.app", StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }

                navArgs.Cancel = true;

                if (uri.IsFile && FileService.IsSupportedDocumentPath(uri.LocalPath))
                {
                    _bridgeHost?.OpenFilesInUi(new[] { uri.LocalPath });
                }
            };

            core.NewWindowRequested += (_, nwArgs) =>
            {
                nwArgs.Handled = true;
                if (FileService.IsSafeExternalUrl(nwArgs.Uri))
                {
                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(nwArgs.Uri)
                    {
                        UseShellExecute = true,
                    });
                }
            };

            core.DocumentTitleChanged += (_, _) =>
            {
                string docTitle = core.DocumentTitle;
                Title = string.IsNullOrWhiteSpace(docTitle) ? "Vellum" : docTitle;
            };

            core.Navigate($"{EmbeddedAssetServer.AppOrigin}/index.html");
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"Vellum could not initialize Edge WebView2 Runtime:\n\n{ex.Message}",
                "Vellum Startup Error",
                MessageBoxButton.OK,
                MessageBoxImage.Error
            );
            _forceClosing = true;
            Close();
        }
    }

    public void OpenIncomingFiles(IReadOnlyList<string> paths)
    {
        Dispatcher.InvokeAsync(() =>
        {
            if (WindowState == WindowState.Minimized)
            {
                WindowState = WindowState.Normal;
            }
            Activate();
            Topmost = true;
            Topmost = false;
            Focus();

            if (paths.Count > 0)
            {
                _bridgeHost?.OpenFilesInUi(paths);
            }
        });
    }

    public void BeginNativeDrag()
    {
        IntPtr hwnd = new WindowInteropHelper(this).Handle;
        if (hwnd == IntPtr.Zero) return;
        Win32Interop.ReleaseCapture();
        Win32Interop.SendMessage(hwnd, Win32Interop.WM_NCLBUTTONDOWN, (IntPtr)Win32Interop.HTCAPTION, IntPtr.Zero);
    }

    public bool ToggleMaximize()
    {
        WindowState = WindowState == WindowState.Maximized
            ? WindowState.Normal
            : WindowState.Maximized;
        return WindowState == WindowState.Maximized;
    }

    public void SetDirtyCount(int count)
    {
        _dirtyCount = Math.Max(0, count);
    }

    public void ForceCloseApproved()
    {
        _forceClosing = true;
        Close();
    }

    private void OnWindowStateChanged(object? sender, EventArgs e)
    {
        _bridgeHost?.SendEvent("window:stateChanged", new
        {
            isMaximized = WindowState == WindowState.Maximized,
        });
    }

    private void OnWindowClosing(object? sender, CancelEventArgs e)
    {
        if (!_forceClosing && _dirtyCount > 0 && _bridgeHost != null)
        {
            e.Cancel = true;
            _bridgeHost.SendEvent("app:requestClose", new { dirtyCount = _dirtyCount });
            return;
        }

        try
        {
            var settings = _settingsService.Load();
            var r = WindowState == WindowState.Normal ? new Rect(Left, Top, Width, Height) : RestoreBounds;
            settings.WindowBounds = new WindowBounds
            {
                Left = r.Left,
                Top = r.Top,
                Width = r.Width,
                Height = r.Height,
                IsMaximized = WindowState == WindowState.Maximized,
            };
            _settingsService.Save(settings);
        }
        catch
        {
            // Do not block exit on bounds save failure
        }
    }
}
