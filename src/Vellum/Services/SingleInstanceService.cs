using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;

namespace Vellum.Services;

public sealed class SingleInstanceService : IDisposable
{
    private const string MutexName = @"Local\VellumMarkdown_SingleInstance_v1";
    private const string PipeName = "VellumMarkdown_IPC_v1";

    private Mutex? _mutex;
    private CancellationTokenSource? _cts;

    public event Action<IReadOnlyList<string>>? FilesReceived;

    public bool TryAcquireOrForward(IReadOnlyList<string> filePaths, bool forceNewWindow)
    {
        if (forceNewWindow)
        {
            return true;
        }

        _mutex = new Mutex(initiallyOwned: true, MutexName, out bool createdNew);
        if (createdNew)
        {
            StartPipeServer();
            return true;
        }

        try
        {
            using var client = new NamedPipeClientStream(".", PipeName, PipeDirection.Out);
            client.Connect(timeout: 1500);
            using var writer = new StreamWriter(client, Encoding.UTF8, leaveOpen: false);
            string payload = JsonSerializer.Serialize(filePaths);
            writer.WriteLine(payload);
            writer.Flush();
        }
        catch
        {
            // Primary instance may be shutting down; allow secondary exit cleanly
        }

        _mutex.Dispose();
        _mutex = null;
        return false;
    }

    private void StartPipeServer()
    {
        _cts = new CancellationTokenSource();
        var token = _cts.Token;

        _ = Task.Run(async () =>
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    await using var server = new NamedPipeServerStream(
                        PipeName,
                        PipeDirection.In,
                        NamedPipeServerStream.MaxAllowedServerInstances,
                        PipeTransmissionMode.Byte,
                        PipeOptions.Asynchronous
                    );

                    await server.WaitForConnectionAsync(token);
                    using var reader = new StreamReader(server, Encoding.UTF8);
                    string? line = await reader.ReadLineAsync(token);
                    if (!string.IsNullOrWhiteSpace(line))
                    {
                        var files = JsonSerializer.Deserialize<List<string>>(line) ?? new List<string>();
                        FilesReceived?.Invoke(files);
                    }
                    else
                    {
                        FilesReceived?.Invoke(Array.Empty<string>());
                    }
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch
                {
                    await Task.Delay(150, token);
                }
            }
        }, token);
    }

    public void Dispose()
    {
        _cts?.Cancel();
        _cts?.Dispose();
        if (_mutex != null)
        {
            try { _mutex.ReleaseMutex(); } catch { }
            _mutex.Dispose();
            _mutex = null;
        }
    }
}
