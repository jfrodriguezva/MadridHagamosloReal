using System;
using System.IO;
using System.Windows;
using System.Windows.Threading;

namespace Madrid.Desktop;

/// <summary>
/// Interaction logic for App.xaml
/// </summary>
public partial class App : System.Windows.Application
{
    // Sin esto, cualquier excepción no controlada (típicamente en los async void
    // del arranque: levantar la API, el portal, o WebView2) cierra la ventana de
    // golpe y sin explicación -- desde fuera parece que la app "no abre". Se deja
    // rastro en un archivo y se avisa en pantalla antes de morir.
    private static readonly string LogPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "MadridHagamosloReal", "error.log");

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        DispatcherUnhandledException += (_, args) =>
        {
            Report(args.Exception, "interfaz");
            args.Handled = true; // la app sigue viva: un fallo aislado no debe tumbarla
        };

        AppDomain.CurrentDomain.UnhandledException += (_, args) =>
            Report(args.ExceptionObject as Exception, "proceso");

        System.Threading.Tasks.TaskScheduler.UnobservedTaskException += (_, args) =>
        {
            Report(args.Exception, "tarea en segundo plano");
            args.SetObserved();
        };
    }

    private static void Report(Exception? ex, string origen)
    {
        if (ex is null) return;
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(LogPath)!);
            File.AppendAllText(LogPath,
                $"=== {DateTime.Now:yyyy-MM-dd HH:mm:ss} ({origen}) ==={Environment.NewLine}{ex}{Environment.NewLine}{Environment.NewLine}");
        }
        catch
        {
            // si ni siquiera se puede escribir el log, no hay nada que hacer
        }

        // calificado: con UseWindowsForms+UseWPF, "MessageBox" es ambiguo
        System.Windows.MessageBox.Show(
            $"Ocurrió un error en la app ({origen}):{Environment.NewLine}{Environment.NewLine}{ex.Message}{Environment.NewLine}{Environment.NewLine}Detalle completo en:{Environment.NewLine}{LogPath}",
            "Madrid Hagámoslo Real",
            MessageBoxButton.OK,
            MessageBoxImage.Warning);
    }
}
