using System.Runtime.InteropServices;
using System.Text;

namespace Vellum.Native;

internal static class Win32Interop
{
    public const int WM_NCLBUTTONDOWN = 0x00A1;
    public const int HTCAPTION = 2;
    public const int WM_GETMINMAXINFO = 0x0024;
    public const int MONITOR_DEFAULTTONEAREST = 2;

    public const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
    public const int DWMWA_WINDOW_CORNER_PREFERENCE = 33;
    public const int DWMWCP_ROUND = 2;

    public const uint SHCNE_ASSOCCHANGED = 0x08000000;
    public const uint SHCNF_IDLIST = 0x0000;
    public const uint ASSOCF_NONE = 0x00000000;
    public const uint ASSOCSTR_PROGID = 20;

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT
    {
        public int x;
        public int y;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MINMAXINFO
    {
        public POINT ptReserved;
        public POINT ptMaxSize;
        public POINT ptMaxPosition;
        public POINT ptMinTrackSize;
        public POINT ptMaxTrackSize;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    public struct MONITORINFO
    {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public int dwFlags;
    }

    [DllImport("user32.dll")]
    public static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    public static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern IntPtr MonitorFromWindow(IntPtr hwnd, int dwFlags);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);

    [DllImport("dwmapi.dll", PreserveSig = true)]
    public static extern int DwmSetWindowAttribute(
        IntPtr hwnd,
        int attr,
        ref int attrValue,
        int attrSize
    );

    [DllImport("shell32.dll")]
    public static extern void SHChangeNotify(
        uint wEventId,
        uint uFlags,
        IntPtr dwItem1,
        IntPtr dwItem2
    );

    [DllImport("Shlwapi.dll", CharSet = CharSet.Unicode)]
    private static extern uint AssocQueryString(
        uint flags,
        uint str,
        string pszAssoc,
        string? pszExtra,
        StringBuilder? pszOut,
        ref uint pcchOut
    );

    /// <summary>
    /// Queries the Windows Shell for the effective ProgId assigned to a file extension.
    /// </summary>
    public static string? QueryAssocProgId(string extension)
    {
        try
        {
            uint length = 0;
            _ = AssocQueryString(ASSOCF_NONE, ASSOCSTR_PROGID, extension, null, null, ref length);
            if (length == 0) return null;

            var sb = new StringBuilder((int)length);
            uint hr = AssocQueryString(ASSOCF_NONE, ASSOCSTR_PROGID, extension, null, sb, ref length);
            return hr == 0 && sb.Length > 0 ? sb.ToString() : null;
        }
        catch
        {
            return null;
        }
    }

    public static void ApplyWindowFrameAttributes(IntPtr hwnd, bool isDark)
    {
        if (hwnd == IntPtr.Zero) return;
        int dark = isDark ? 1 : 0;
        _ = DwmSetWindowAttribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, ref dark, sizeof(int));

        int round = DWMWCP_ROUND;
        _ = DwmSetWindowAttribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, ref round, sizeof(int));
    }

    public static void HandleWmGetMinMaxInfo(IntPtr hwnd, IntPtr lParam)
    {
        var mmi = Marshal.PtrToStructure<MINMAXINFO>(lParam);
        IntPtr monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        if (monitor != IntPtr.Zero)
        {
            var info = new MONITORINFO { cbSize = Marshal.SizeOf<MONITORINFO>() };
            if (GetMonitorInfo(monitor, ref info))
            {
                RECT work = info.rcWork;
                RECT mon = info.rcMonitor;
                mmi.ptMaxPosition.x = Math.Abs(work.Left - mon.Left);
                mmi.ptMaxPosition.y = Math.Abs(work.Top - mon.Top);
                mmi.ptMaxSize.x = Math.Abs(work.Right - work.Left);
                mmi.ptMaxSize.y = Math.Abs(work.Bottom - work.Top);
            }
        }
        mmi.ptMinTrackSize.x = 680;
        mmi.ptMinTrackSize.y = 460;
        Marshal.StructureToPtr(mmi, lParam, true);
    }
}
