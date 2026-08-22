; MadridHagamosloReal.iss -- instalador "siguiente, siguiente, terminar"
;
; Requiere Inno Setup (gratis, https://jrsoftware.org/isinfo.php) para compilar
; en un .exe instalable. No lo compilo yo automáticamente porque instalar
; software nuevo en tu sistema es una decisión que te corresponde a ti;
; una vez tengas Inno Setup, compilar este script es: abrir el archivo con
; el Compilador de Inno Setup y presionar "Compile" (o ISCC.exe desde consola).
;
; Qué hace la instalación:
;   1. Copia la app WPF (Madrid.Desktop, ya con el WebView2 embebido)
;   2. Copia el API publicado en modo self-contained (no requiere .NET aparte)
;   3. Copia el build de producción de Next.js
;   4. Copia madrid.db (SQLite) con todo el histórico ya cargado
;   5. Crea accesos directos en el Menú Inicio y el Escritorio
;   6. Al finalizar, ofrece instalar el servicio de Windows (install-service.ps1)

#define MyAppName "Madrid Hagámoslo Real"
#define MyAppVersion "1.0"
#define MyAppExeName "Madrid.Desktop.exe"

[Setup]
AppId={{B3B8B6C0-6F2A-4A2F-9C1D-7F5E2A9E1D01}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={autopf}\MadridHagamosloReal
DefaultGroupName={#MyAppName}
OutputBaseFilename=MadridHagamosloReal-Setup
SetupIconFile=..\desktop\Assets\monogram.ico
UninstallDisplayIcon={app}\desktop\{#MyAppExeName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
DisableWelcomePage=no
DisableProgramGroupPage=yes

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
Source: "..\desktop\bin\Release\net10.0-windows\win-x64\publish\*"; DestDir: "{app}\desktop"; Flags: recursesubdirs ignoreversion
Source: "..\api\publish\*"; DestDir: "{app}\api"; Flags: recursesubdirs ignoreversion
Source: "..\web\.next\standalone\*"; DestDir: "{app}\web"; Flags: recursesubdirs ignoreversion
Source: "..\desktop\madrid.db"; DestDir: "{app}\data"; Flags: ignoreversion
Source: "runtime\node.exe"; DestDir: "{app}\runtime"; Flags: ignoreversion
Source: "runtime\python\*"; DestDir: "{app}\runtime\python"; Flags: recursesubdirs ignoreversion
Source: "..\ml-service\data\db_sqlite.py"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\ml-service\data\refresh_current.py"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "scripts\.env.example"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "install-service.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "uninstall-service.ps1"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\desktop\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\desktop\{#MyAppExeName}"

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\install-service.ps1"" -PublishPath ""{app}\api"""; \
    Description: "Instalar el servicio de Windows (recomendado -- así corre en segundo plano sin ventana de consola)"; \
    Flags: postinstall runascurrentuser
Filename: "{app}\desktop\{#MyAppExeName}"; Description: "Abrir {#MyAppName}"; Flags: postinstall nowait skipifsilent unchecked

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\uninstall-service.ps1"""; Flags: runhidden
