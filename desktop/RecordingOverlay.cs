using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Shapes;

// El proyecto usa WPF y WinForms a la vez (WinForms solo por el NotifyIcon de
// la bandeja), así que estos nombres son ambiguos y hay que fijar la variante
// de WPF explícitamente.
using Brush = System.Windows.Media.Brush;
using Brushes = System.Windows.Media.Brushes;
using Button = System.Windows.Controls.Button;
using Color = System.Windows.Media.Color;
using Colors = System.Windows.Media.Colors;
using Cursors = System.Windows.Input.Cursors;
using FontFamily = System.Windows.Media.FontFamily;
using HorizontalAlignment = System.Windows.HorizontalAlignment;
using Orientation = System.Windows.Controls.Orientation;
using Rectangle = System.Windows.Shapes.Rectangle;
using VerticalAlignment = System.Windows.VerticalAlignment;

namespace Madrid.Desktop;

/// <summary>
/// Control flotante de grabación, estilo iPhone: una píldora sin bordes que
/// vive por encima de todas las ventanas del sistema con el cronómetro, el
/// nivel del micrófono, pausa y detener.
///
/// Existe como ventana nativa (y no solo como elemento de la página) porque es
/// justo lo que la web no puede hacer: seguir visible y clicable cuando el
/// usuario se va a otra aplicación a grabar. Esa es la regla del proyecto para
/// usar el puente nativo.
///
/// Se construye en código en vez de XAML porque son cuatro controles y así
/// queda todo el comportamiento en un solo archivo.
/// </summary>
public class RecordingOverlay : Window
{
    /// <summary>"stop", "pause" o "resume" -- lo ejecuta la página, que es
    /// quien tiene el MediaRecorder.</summary>
    public event Action<string>? CommandIssued;

    private readonly TextBlock _timer;
    private readonly Ellipse _dot;
    private readonly Button _pauseButton;
    private readonly Rectangle _micLevel;
    private readonly Border _micTrack;
    private bool _paused;

    public RecordingOverlay()
    {
        WindowStyle = WindowStyle.None;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        Topmost = true;
        ShowInTaskbar = false;
        ResizeMode = ResizeMode.NoResize;
        SizeToContent = SizeToContent.WidthAndHeight;
        // sin esto, al abrirse le robaría el foco a la app que el usuario está
        // grabando justo cuando empieza a hablar
        ShowActivated = false;

        _dot = new Ellipse
        {
            Width = 10,
            Height = 10,
            Fill = new SolidColorBrush(Color.FromRgb(0xE2, 0x46, 0x4F)),
            VerticalAlignment = VerticalAlignment.Center,
        };

        _timer = new TextBlock
        {
            Text = "0:00",
            Foreground = Brushes.White,
            FontFamily = new FontFamily("Consolas"),
            FontSize = 13,
            MinWidth = 42,
            VerticalAlignment = VerticalAlignment.Center,
        };

        _micTrack = new Border
        {
            Width = 34,
            Height = 4,
            CornerRadius = new CornerRadius(2),
            Background = new SolidColorBrush(Color.FromArgb(0x38, 0xFF, 0xFF, 0xFF)),
            VerticalAlignment = VerticalAlignment.Center,
            ToolTip = "Nivel del micrófono",
        };
        _micLevel = new Rectangle
        {
            Width = 0,
            Height = 4,
            RadiusX = 2,
            RadiusY = 2,
            HorizontalAlignment = HorizontalAlignment.Left,
            Fill = new SolidColorBrush(Color.FromRgb(0x4E, 0xC2, 0x7A)),
        };
        _micTrack.Child = _micLevel;

        _pauseButton = PillButton("PAUSA", Brushes.Transparent, Brushes.White);
        _pauseButton.Click += (_, _) => CommandIssued?.Invoke(_paused ? "resume" : "pause");

        var stopButton = PillButton("DETENER", new SolidColorBrush(Color.FromRgb(0xE2, 0x46, 0x4F)), Brushes.White);
        stopButton.FontWeight = FontWeights.Bold;
        stopButton.Click += (_, _) => CommandIssued?.Invoke("stop");

        var row = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center };
        foreach (UIElement child in new UIElement[] { _dot, _timer, _micTrack, _pauseButton, stopButton })
        {
            if (child is FrameworkElement fe) fe.Margin = new Thickness(5, 0, 5, 0);
            row.Children.Add(child);
        }

        Content = new Border
        {
            Background = new SolidColorBrush(Color.FromArgb(0xF0, 0x14, 0x0F, 0x28)),
            CornerRadius = new CornerRadius(20),
            Padding = new Thickness(10, 7, 10, 7),
            Child = row,
            Effect = new System.Windows.Media.Effects.DropShadowEffect
            {
                BlurRadius = 14,
                ShadowDepth = 2,
                Opacity = 0.45,
                Color = Colors.Black,
            },
        };

        // arrastrable: el usuario la mueve si le tapa algo de lo que graba
        MouseLeftButtonDown += (_, e) =>
        {
            if (e.ButtonState == MouseButtonState.Pressed) DragMove();
        };

        Loaded += (_, _) => PositionTopRight();
        StartBlinking();
    }

    private static Button PillButton(string text, Brush background, Brush foreground)
    {
        var button = new Button
        {
            Content = text,
            Background = background,
            Foreground = foreground,
            FontFamily = new FontFamily("Consolas"),
            FontSize = 10,
            Padding = new Thickness(9, 3, 9, 3),
            BorderThickness = new Thickness(background == Brushes.Transparent ? 1 : 0),
            BorderBrush = new SolidColorBrush(Color.FromArgb(0x59, 0xFF, 0xFF, 0xFF)),
            Cursor = Cursors.Hand,
            VerticalAlignment = VerticalAlignment.Center,
        };

        // plantilla mínima: el ChromeButton por defecto de WPF pinta un fondo
        // gris propio que rompe la píldora
        var template = new ControlTemplate(typeof(Button));
        var border = new FrameworkElementFactory(typeof(Border));
        border.SetBinding(Border.BackgroundProperty, new System.Windows.Data.Binding("Background") { RelativeSource = System.Windows.Data.RelativeSource.TemplatedParent });
        border.SetBinding(Border.BorderBrushProperty, new System.Windows.Data.Binding("BorderBrush") { RelativeSource = System.Windows.Data.RelativeSource.TemplatedParent });
        border.SetBinding(Border.BorderThicknessProperty, new System.Windows.Data.Binding("BorderThickness") { RelativeSource = System.Windows.Data.RelativeSource.TemplatedParent });
        border.SetBinding(Border.PaddingProperty, new System.Windows.Data.Binding("Padding") { RelativeSource = System.Windows.Data.RelativeSource.TemplatedParent });
        border.SetValue(Border.CornerRadiusProperty, new CornerRadius(11));
        var presenter = new FrameworkElementFactory(typeof(ContentPresenter));
        presenter.SetValue(HorizontalAlignmentProperty, HorizontalAlignment.Center);
        presenter.SetValue(VerticalAlignmentProperty, VerticalAlignment.Center);
        border.AppendChild(presenter);
        template.VisualTree = border;
        button.Template = template;

        return button;
    }

    private void PositionTopRight()
    {
        var work = SystemParameters.WorkArea;
        Left = work.Right - ActualWidth - 18;
        Top = work.Top + 14;
    }

    private void StartBlinking()
    {
        var blink = new DoubleAnimation
        {
            From = 1.0,
            To = 0.25,
            Duration = TimeSpan.FromSeconds(0.7),
            AutoReverse = true,
            RepeatBehavior = RepeatBehavior.Forever,
        };
        _dot.BeginAnimation(OpacityProperty, blink);
    }

    /// <summary>Refresca lo que la página reporta cada segundo.</summary>
    public void UpdateState(int seconds, bool paused, double micLevel)
    {
        _paused = paused;
        _timer.Text = $"{seconds / 60}:{seconds % 60:00}";
        _pauseButton.Content = paused ? "SEGUIR" : "PAUSA";
        _dot.Fill = paused
            ? new SolidColorBrush(Color.FromRgb(0xC9, 0xC5, 0xDF))
            : new SolidColorBrush(Color.FromRgb(0xE2, 0x46, 0x4F));
        _dot.Opacity = paused ? 0.6 : _dot.Opacity;

        double nivel = Math.Clamp(micLevel, 0, 1);
        _micLevel.Width = 34 * nivel;
        _micLevel.Fill = nivel > 0.03
            ? new SolidColorBrush(Color.FromRgb(0x4E, 0xC2, 0x7A))
            : new SolidColorBrush(Color.FromRgb(0xE2, 0x46, 0x4F));
    }
}
