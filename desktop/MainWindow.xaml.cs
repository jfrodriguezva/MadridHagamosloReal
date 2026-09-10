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
        SourceInitialized += MainWindow_SourceInitialized;
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

    // Respaldo automático de madrid.db en cada arranque de la app instalada -- es la
    // única fuente de verdad del histórico ahí (no hay SQL Server de por medio). Sin
    // esto, un archivo corrupto o borrado por accidente se lleva todo el proyecto.
    // Se copia ANTES de arrancar la API para minimizar la chance de copiar el archivo
    // a mitad de una escritura; nunca debe tumbar el arranque de la app si falla.
    private const int MaxBackups = 14;

    private void BackupDatabase()
    {
        if (!IsInstalled || !File.Exists(InstalledDb)) return;
        try
        {
            var backupDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "MadridHagamosloReal", "Backups");
            Directory.CreateDirectory(backupDir);

            var dest = Path.Combine(backupDir, $"madrid-{DateTime.Now:yyyyMMdd-HHmmss}.db");
            File.Copy(InstalledDb, dest, overwrite: true);

            var old = new DirectoryInfo(backupDir).GetFiles("madrid-*.db")
                .OrderByDescending(f => f.CreationTimeUtc)
                .Skip(MaxBackups);
            foreach (var f in old)
            {
                try { f.Delete(); } catch { /* no bloquear por un archivo que no se pudo borrar */ }
            }
        }
        catch
        {
            // El backup nunca debe impedir que la app abra -- si falla (disco lleno,
            // DB bloqueada de forma exclusiva, etc.) simplemente se reintenta la próxima vez.
        }
    }

    // El XAML pide 1400x900, pero eso son DIPs: en una pantalla con escala de
    // Windows la superficie útil es bastante menor (ej. 1536x864 al 125% deja
    // 1229x653 DIPs). Con WindowStartupLocation="CenterScreen", una ventana más
    // alta que la pantalla se centra dejando la barra de título POR ENCIMA del
    // borde superior: la app queda sin botones de minimizar/maximizar/cerrar y
    // sin nada de dónde arrastrarla. Por eso el tamaño se ajusta al área de
    // trabajo real antes de mostrarla, ya con el DPI del monitor resuelto.
    private void MainWindow_SourceInitialized(object? sender, EventArgs e)
    {
        var work = SystemParameters.WorkArea;
        _arrancarMaximizada = Width > work.Width || Height > work.Height;
        FitIntoWorkArea();
    }

    // Si ni el tamaño preferido entraba en la pantalla, conviene arrancar
    // maximizada. OJO: no se puede hacer desde SourceInitialized -- cambiar el
    // WindowState antes de que WebView2 cree su controlador lo hace fallar con
    // COMException 0x8007139F ("el recurso no está en el estado correcto") y la
    // app queda con la ventana en blanco. Se aplica en Loaded, ya con WebView2
    // inicializado. Al restaurar, la ventana queda con el tamaño ya ajustado.
    private bool _arrancarMaximizada;

    // Encoge y recentra la ventana dentro del área de trabajo del monitor.
    private void FitIntoWorkArea()
    {
        var work = SystemParameters.WorkArea;
        Width = Math.Min(Width, work.Width);
        Height = Math.Min(Height, work.Height);
        Left = work.Left + (work.Width - Width) / 2;
        Top = work.Top + (work.Height - Height) / 2;
    }

    // Rescate desde la bandeja: devuelve la ventana al área visible aunque haya
    // quedado minimizada, detrás de todo, o fuera de pantalla (típico al
    // desconectar un segundo monitor o al cambiar la escala de Windows).
    private void RestoreWindow(WindowState target)
    {
        Show();
        WindowState = WindowState.Normal;

        var work = SystemParameters.WorkArea;
        bool fueraDeVista = Left + Width < work.Left + 80 || Left > work.Right - 80
                            || Top < work.Top - 1 || Top > work.Bottom - 40;
        if (fueraDeVista) FitIntoWorkArea();

        WindowState = target;
        Activate();
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
        // Sin este try/catch la excepción viaja sin capturar y mata el proceso
        // antes de pintar nada: desde fuera es "hice clic y no pasó nada", y el
        // motivo solo aparece en el Visor de eventos de Windows. Los dos casos
        // reales vistos son ambos COMException 0x8007139F: la sesión de Windows
        // bloqueada (WebView2 necesita un escritorio componiendo para crear el
        // controlador) y una segunda instancia sobre la misma carpeta de datos.
        try
        {
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: userDataFolder);
            await Browser.EnsureCoreWebView2Async(environment);
        }
        catch (Exception ex)
        {
            bool estadoInvalido = ex is System.Runtime.InteropServices.COMException com
                && com.HResult == unchecked((int)0x8007139F);
            StatusText.Text = estadoInvalido
                ? "No se pudo iniciar WebView2. Suele ser la pantalla bloqueada o la app ya abierta: desbloquea el equipo o cierra la otra ventana y vuelve a intentar."
                : $"No se pudo iniciar WebView2: {ex.Message}";
            return;
        }
        Browser.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
        Browser.CoreWebView2.PermissionRequested += OnPermissionRequested;

        if (_arrancarMaximizada) WindowState = WindowState.Maximized;

        BackupDatabase();

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

        // Control de ventana desde la bandeja. Además de ser cómodo, es la vía
        // de rescate cuando la ventana queda inalcanzable (fuera de pantalla,
        // detrás de otra app, o minimizada sin botón visible).
        var menu = new System.Windows.Forms.ContextMenuStrip();
        menu.Items.Add("Mostrar / Restaurar", null, (_, _) => RestoreWindow(WindowState.Normal));
        menu.Items.Add("Maximizar", null, (_, _) => RestoreWindow(WindowState.Maximized));
        menu.Items.Add("Minimizar", null, (_, _) => WindowState = WindowState.Minimized);
        menu.Items.Add("Centrar en pantalla", null, (_, _) =>
        {
            WindowState = WindowState.Normal;
            FitIntoWorkArea();
            Activate();
        });
        menu.Items.Add(new System.Windows.Forms.ToolStripSeparator());
        menu.Items.Add("Salir", null, (_, _) => Close());
        _trayIcon.ContextMenuStrip = menu;
        _trayIcon.DoubleClick += (_, _) => RestoreWindow(WindowState.Normal);

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

    // El grabador del podcast (Podcast -> GRABAR LOCAL) pide el micrófono desde
    // la propia página del portal. Sin este handler WebView2 decide solo, y en
    // una app de escritorio ese diálogo aparece sin contexto o directamente se
    // deniega. El usuario ya expresó su intención al pulsar GRABAR, así que se
    // concede -- pero únicamente el micrófono y únicamente al portal local
    // (localhost). Cualquier otro permiso u origen sigue el camino por defecto.
    // La grabación en sí es local: se escribe un .webm en el equipo y no sale
    // nada a la red.
    private void OnPermissionRequested(object? sender, CoreWebView2PermissionRequestedEventArgs e)
    {
        if (e.PermissionKind == CoreWebView2PermissionKind.Microphone
            && Uri.TryCreate(e.Uri, UriKind.Absolute, out var origin)
            && origin.IsLoopback)
        {
            e.State = CoreWebView2PermissionState.Allow;
            e.Handled = true;
        }
    }

    // Puente nativo WPF <-> web: la página llama window.chrome.webview.postMessage({type:"pickVideoFile"})
    // y aquí respondemos con la ruta elegida via un selector de archivos nativo de Windows.
    // Control flotante de grabación. Vive como ventana nativa always-on-top
    // porque tiene que seguir visible y clicable cuando el usuario se va a otra
    // aplicación a grabar -- eso una página web no lo puede hacer. La página
    // sigue siendo la dueña del MediaRecorder: aquí solo se muestra el estado y
    // se le reenvían los botones.
    private RecordingOverlay? _recordingOverlay;

    private void ShowRecordingOverlay()
    {
        if (_recordingOverlay is null)
        {
            _recordingOverlay = new RecordingOverlay { Owner = null };
            _recordingOverlay.CommandIssued += command =>
                Browser.CoreWebView2?.PostWebMessageAsJson(
                    System.Text.Json.JsonSerializer.Serialize(new { type = "recordingCommand", command }));
        }
        _recordingOverlay.Show();
    }

    private void HideRecordingOverlay()
    {
        _recordingOverlay?.Hide();
    }

    private void OnWebMessageReceived(object? sender, Microsoft.Web.WebView2.Core.CoreWebView2WebMessageReceivedEventArgs e)
    {
        string json;
        try { json = e.WebMessageAsJson; } catch { return; }

        using var doc = System.Text.Json.JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("type", out var typeEl)) return;
        var type = typeEl.GetString();

        if (type == "recordingStarted")
        {
            ShowRecordingOverlay();
            return;
        }
        else if (type == "recordingState")
        {
            int seconds = doc.RootElement.TryGetProperty("seconds", out var s) ? s.GetInt32() : 0;
            bool paused = doc.RootElement.TryGetProperty("paused", out var p) && p.GetBoolean();
            double level = doc.RootElement.TryGetProperty("micLevel", out var l) ? l.GetDouble() : 0;
            _recordingOverlay?.UpdateState(seconds, paused, level);
            return;
        }
        else if (type == "recordingStopped")
        {
            HideRecordingOverlay();
            return;
        }

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
        // la píldora es una ventana aparte: sin cerrarla, la app quedaría viva
        // en segundo plano tras cerrar la ventana principal
        _recordingOverlay?.Close();
        _recordingOverlay = null;
        if (_trayIcon != null) _trayIcon.Visible = false;
        _trayIcon?.ContextMenuStrip?.Dispose();
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
