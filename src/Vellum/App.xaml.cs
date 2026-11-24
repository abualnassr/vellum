using System.IO;
using System.Windows;
using Vellum.Services;

namespace Vellum;

public partial class App : Application
{
    private SingleInstanceService? _singleInstance;
    private FileService? _fileService;
    private SpellCheckService? _spellCheckService;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        bool forceNewWindow = false;
        var fileArgs = new List<string>();
        foreach (string arg in e.Args)
        {
            if (arg.Equals("--new-window", StringComparison.OrdinalIgnoreCase))
            {
                forceNewWindow = true;
                continue;
            }
            if (!arg.StartsWith("--", StringComparison.Ordinal) && File.Exists(arg))
            {
                fileArgs.Add(Path.GetFullPath(arg));
            }
        }

        _singleInstance = new SingleInstanceService();
        if (!_singleInstance.TryAcquireOrForward(fileArgs, forceNewWindow))
        {
            Shutdown(0);
            return;
        }

        var settingsService = new SettingsService();
        _fileService = new FileService();
        var assocService = new FileAssociationService();
        _spellCheckService = new SpellCheckService();

        var mainWindow = new MainWindow(settingsService, _fileService, assocService, _spellCheckService, fileArgs);
        _singleInstance.FilesReceived += paths => mainWindow.OpenIncomingFiles(paths);

        MainWindow = mainWindow;
        mainWindow.Show();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _spellCheckService?.Dispose();
        _fileService?.Dispose();
        _singleInstance?.Dispose();
        base.OnExit(e);
    }
}
