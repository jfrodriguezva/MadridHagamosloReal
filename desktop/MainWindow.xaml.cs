using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;

namespace Madrid.Desktop;

public partial class MainWindow : Window
{
    // Dos layouts posibles:
    //  - Instalado: {app}\desktop\Madrid.Desktop.exe, con api\, web\, data\ y runtime\ como
    //    hermanos de desktop\ (así arma el instalador Inno Setup) -- todo self-contained/portable.
    //  - Desarrollo: este exe corre desde bin\Debug\net10.0-windows\ dentro del repo, y usamos
    //    el repo directamente (dotnet run sobre el .dll, npm run dev sobre el código fuente).
    private static readonly string AppRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, ".."));
    private static readonly string InstalledApiExe = Path.Combine(AppRoot, "api", "Madrid.Api.exe");
    private static readonly string InstalledWebServer = Path.Combine(AppRoot, "web", "server.js");
    private static readonly string InstalledNode = Path.Combine(AppRoot, "runtime", "node.exe");
    private static readonly string InstalledDb = Path.Combine(AppRoot, "data", "madrid.db");
    private static readonly bool IsInstalled = File.Exists(InstalledApiExe) && File.Exists(InstalledWebServer);

    private static readonly string RepoRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));
    private static readonly string DevApiDll = Path.Combine(RepoRoot, "api", "bin", "Debug", "net10.0", "Madrid.Api.dll");
    private static readonly string DevWebDir = Path.Combine(RepoRoot, "web");

    // Puertos altos (10000/10001) tanto en desarrollo como instalado, para no
    // chocar con otros proyectos que el usuario tenga corriendo en cualquier
    // equipo (ej. otro Next.js en 3000 o otra API en 5080).
    private const int WebPort = 10000;
    private const int ApiPort = 10001;
    private static string WebUrl => $"http://localhost:{WebPort}";
    private static string ApiUrl => $"http://localhost:{ApiPort}";

    private Process? _apiProcess;
    private Process? _webProcess;
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(2) };

    public MainWindow()
    {
        InitializeComponent();
        Loaded += MainWindow_Loaded;
        Closing += MainWindow_Closing;
        TryLoadIcon();
    }

    // Coloca el monograma en desktop/Assets/monogram.png y aparece solo,
    // sin tocar código de nuevo -- mismo archivo que usa la web como favicon.
    private void TryLoadIcon()
    {
        var iconPath = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "Assets", "monogram.png");
        iconPath = Path.GetFullPath(iconPath);
        if (File.Exists(iconPath))
        {
            Icon = new BitmapImage(new Uri(iconPath));
        }
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        // WebView2 intenta por defecto crear su carpeta de datos junto al .exe
        // (ej. "...\Madrid.Desktop.exe.WebView2\"). Cuando la app está instalada
        // en Program Files eso falla sin permisos de administrador, así que le
        // apuntamos a una carpeta escribible en %LOCALAPPDATA% siempre.
        var userDataFolder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "MadridHagamosloReal", "WebView2");
        Directory.CreateDirectory(userDataFolder);
        var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: userDataFolder);
        await Browser.EnsureCoreWebView2Async(environment);
        Browser.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

        await EnsureApiRunning();
        await EnsureWebRunning();

        StatusText.Text = "Cargando el portal…";
        Browser.CoreWebView2.Navigate(WebUrl);
        Browser.CoreWebView2.NavigationCompleted += (_, args) =>
        {
            if (args.IsSuccess) StatusBar.Visibility = Visibility.Collapsed;
        };

        SetupNotifications();
    }

    // Aviso de "próximo partido en 1 hora" -- revisa la API cada 20 min y agenda un
    // único timer para el próximo partido detectado. Usa el globo del ícono de la
    // bandeja (NotifyIcon) en vez de toast UWP porque no requiere empaquetar la app.
    private System.Windows.Forms.NotifyIcon? _trayIcon;
    private DispatcherTimer? _matchCheckTimer;
    private DateTime? _scheduledNotificationFor;

    private void SetupNotifications()
    {
        _trayIcon = new System.Windows.Forms.NotifyIcon
        {
            Icon = System.Drawing.SystemIcons.Application,
            Visible = true,
            Text = "Madrid Hagámoslo Real",
        };
        var iconPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "Assets", "monogram.ico"));
        if (File.Exists(iconPath))
        {
            try { _trayIcon.Icon = new System.Drawing.Icon(iconPath); } catch { }
        }

        _matchCheckTimer = new DispatcherTimer { Interval = TimeSpan.FromMinutes(20) };
        _matchCheckTimer.Tick += async (_, _) => await CheckNextMatchForNotification();
        _matchCheckTimer.Start();
        _ = CheckNextMatchForNotification();
    }

    private async Task CheckNextMatchForNotification()
    {
        try
        {
            var json = await _http.GetStringAsync($"{ApiUrl}/api/dashboard/next-match");
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var kickoff = DateTime.Parse(root.GetProperty("kickoffUtc").GetString()!).ToUniversalTime();
            var home = root.GetProperty("homeTeam").GetString();
            var away = root.GetProperty("awayTeam").GetString();
            var notifyAt = kickoff.AddHours(-1);

            if (_scheduledNotificationFor == kickoff) return; // ya programado para este partido
            _scheduledNotificationFor = kickoff;

            var delay = notifyAt - DateTime.UtcNow;
            if (delay < TimeSpan.Zero || delay > TimeSpan.FromDays(7)) return;

            var timer = new DispatcherTimer { Interval = delay };
            timer.Tick += (_, _) =>
            {
                timer.Stop();
                _trayIcon?.ShowBalloonTip(15000, "Real Madrid en 1 hora", $"{home} vs {away} empieza pronto.",
                    System.Windows.Forms.ToolTipIcon.Info);
            };
            timer.Start();
        }
        catch
        {
            // sin próximo partido en la BD o API no disponible todavía -- reintenta en el próximo tick
        }
    }

    private int _mediaHostCounter = 0;

    // Mapea la carpeta del archivo elegido a un host virtual https:// -- así el
    // navegador (y ffmpeg.wasm, que necesita hacer fetch() de bytes reales) puede
    // leerlo igual que un recurso web normal, sin los líos de permisos/CORS de file://.
    private string MapFileToVirtualUrl(string filePath)
    {
        var dir = System.IO.Path.GetDirectoryName(filePath)!;
        var host = $"media{_mediaHostCounter++}.local";
        Browser.CoreWebView2.SetVirtualHostNameToFolderMapping(
            host, dir, Microsoft.Web.WebView2.Core.CoreWebView2HostResourceAccessKind.Allow);
        return $"https://{host}/{Uri.EscapeDataString(System.IO.Path.GetFileName(filePath))}";
    }

    // Puente nativo WPF <-> web: la página llama window.chrome.webview.postMessage({type:"pickVideoFile"})
    // y aquí respondemos con la ruta elegida via un selector de archivos nativo de Windows.
    private void OnWebMessageReceived(object? sender, Microsoft.Web.WebView2.Core.CoreWebView2WebMessageReceivedEventArgs e)
    {
        string json;
        try { json = e.WebMessageAsJson; } catch { return; }

        using var doc = System.Text.Json.JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("type", out var typeEl)) return;
        var type = typeEl.GetString();

        if (type == "pickVideoFile")
        {
            var dialog = new Microsoft.Win32.OpenFileDialog
            {
                Title = "Selecciona tu grabación",
                Filter = "Video (*.mp4;*.mov;*.mkv;*.avi)|*.mp4;*.mov;*.mkv;*.avi|Todos los archivos (*.*)|*.*",
            };
            bool picked = dialog.ShowDialog(this) == true;
            var response = picked
                ? new { type = "videoFilePicked", path = dialog.FileName, name = System.IO.Path.GetFileName(dialog.FileName), url = MapFileToVirtualUrl(dialog.FileName) }
                : new { type = "videoFilePicked", path = (string?)null, name = (string?)null, url = (string?)null };
            Browser.CoreWebView2.PostWebMessageAsJson(System.Text.Json.JsonSerializer.Serialize(response));
        }
        else if (type == "pickImageFile")
        {
            var dialog = new Microsoft.Win32.OpenFileDialog
            {
                Title = "Selecciona una imagen",
                Filter = "Imagen (*.png;*.jpg;*.jpeg;*.webp)|*.png;*.jpg;*.jpeg;*.webp|Todos los archivos (*.*)|*.*",
            };
            bool picked = dialog.ShowDialog(this) == true;
            var response = picked
                ? new { type = "imageFilePicked", path = dialog.FileName, name = System.IO.Path.GetFileName(dialog.FileName), url = MapFileToVirtualUrl(dialog.FileName) }
                : new { type = "imageFilePicked", path = (string?)null, name = (string?)null, url = (string?)null };
            Browser.CoreWebView2.PostWebMessageAsJson(System.Text.Json.JsonSerializer.Serialize(response));
        }
    }

    private async Task<bool> IsUp(string url)
    {
        try
        {
            var resp = await _http.GetAsync(url);
            return resp.IsSuccessStatusCode || (int)resp.StatusCode < 500;
        }
        catch
        {
            return false;
        }
    }

    private async Task EnsureApiRunning()
    {
        if (await IsUp($"{ApiUrl}/api/health"))
        {
            StatusText.Text = "API ya estaba corriendo, conectando…";
            return;
        }

        StatusText.Text = "Iniciando el servicio de datos (API)…";
        var apiStart = IsInstalled
            ? new ProcessStartInfo
            {
                FileName = InstalledApiExe,
                UseShellExecute = false,
                CreateNoWindow = true,
                EnvironmentVariables =
                {
                    ["ASPNETCORE_URLS"] = ApiUrl,
                    ["DB_PROVIDER"] = "sqlite",
                    ["SQLITE_PATH"] = InstalledDb,
                },
            }
            : new ProcessStartInfo
            {
                FileName = "dotnet",
                Arguments = $"\"{DevApiDll}\"",
                UseShellExecute = false,
                CreateNoWindow = true,
                EnvironmentVariables = { ["ASPNETCORE_URLS"] = ApiUrl },
            };
        _apiProcess = new Process { StartInfo = apiStart };
        _apiProcess.Start();

        for (int i = 0; i < 30; i++)
        {
            if (await IsUp($"{ApiUrl}/api/health")) return;
            await Task.Delay(500);
        }
    }

    private async Task EnsureWebRunning()
    {
        if (await IsUp(WebUrl))
        {
            StatusText.Text = "Portal ya estaba corriendo, conectando…";
            return;
        }

        StatusText.Text = "Iniciando el portal (Next.js)…";
        var webStart = IsInstalled
            ? new ProcessStartInfo
            {
                FileName = InstalledNode,
                Arguments = $"\"{InstalledWebServer}\"",
                WorkingDirectory = Path.GetDirectoryName(InstalledWebServer),
                UseShellExecute = false,
                CreateNoWindow = true,
                EnvironmentVariables = { ["PORT"] = WebPort.ToString() },
            }
            : new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = "/c npm run dev",
                WorkingDirectory = DevWebDir,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
        _webProcess = new Process { StartInfo = webStart };
        _webProcess.Start();

        for (int i = 0; i < 60; i++)
        {
            if (await IsUp(WebUrl)) return;
            await Task.Delay(500);
        }
    }

    private void MainWindow_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        // solo cerramos los procesos que ESTA ventana arrancó -- si ya estaban
        // corriendo (ej. sesión de desarrollo), los dejamos como estaban.
        TryKill(_webProcess);
        TryKill(_apiProcess);
        _matchCheckTimer?.Stop();
        if (_trayIcon != null) _trayIcon.Visible = false;
        _trayIcon?.Dispose();
    }

    private static void TryKill(Process? p)
    {
        if (p is null) return;
        try
        {
            if (!p.HasExited) p.Kill(entireProcessTree: true);
        }
        catch
        {
            // ya se había cerrado o no se pudo -- no bloquear el cierre de la app por esto
        }
    }
}
