@echo off
rem ---------------------------------------------------------------------------
rem Arranque de un solo clic del proyecto en modo desarrollo.
rem
rem La ventana WPF ya sabe levantar sola la API y el portal (EnsureApiRunning /
rem EnsureWebRunning en desktop\MainWindow.xaml.cs), pero en modo desarrollo
rem lanza la API sin decirle el motor de base de datos, y el default es SQL
rem Server. En un equipo sin SQL Server hay que fijar SQLite aqui: los procesos
rem que arranca la ventana heredan estas variables de entorno.
rem ---------------------------------------------------------------------------
setlocal
title Madrid Hagamoslo Real - iniciando

set "REPO=%~dp0"
set "REPO=%REPO:~0,-1%"

rem WebView2 no admite dos instancias sobre la misma carpeta de datos: abrir
rem una segunda revienta con COMException 0x8007139F. Si ya esta abierta, salir.
tasklist /fi "imagename eq Madrid.Desktop.exe" | find /i "Madrid.Desktop.exe" >nul
if not errorlevel 1 (
  echo La aplicacion ya esta abierta.
  exit /b 0
)

rem dotnet y node no siempre quedan en el PATH de la sesion actual tras instalarlos
set "PATH=%ProgramFiles%\dotnet;%ProgramFiles%\nodejs;%PATH%"

set "DB_PROVIDER=sqlite"
set "SQLITE_PATH=%REPO%\desktop\madrid.db"

rem Los botones "Actualizar datos" y "Traer rueda de prensa" corren scripts de
rem ml-service\data con un interprete de Python. En la app instalada va uno
rem portatil junto al .exe; en desarrollo se apunta con estas dos variables.
set "SCRIPTS_DIR=%REPO%\ml-service\data"
if exist "%REPO%\installer\runtime\python\python.exe" set "PYTHON_EXE=%REPO%\installer\runtime\python\python.exe"
if not defined PYTHON_EXE if exist "%REPO%\ml-service\.venv\Scripts\python.exe" set "PYTHON_EXE=%REPO%\ml-service\.venv\Scripts\python.exe"
if not defined PYTHON_EXE echo AVISO: no hay Python en el proyecto, los botones "Actualizar datos" y "Traer rueda de prensa" van a avisar que falta.

rem sin esto el portal apunta al puerto 5080 por defecto y carga sin datos
if not exist "%REPO%\web\.env.local" (
  echo NEXT_PUBLIC_API_URL=http://localhost:10001> "%REPO%\web\.env.local"
)

if not exist "%REPO%\web\node_modules" (
  echo Instalando dependencias del portal, esto tarda un par de minutos...
  pushd "%REPO%\web"
  call npm install --no-fund --no-audit
  set "NPMFAIL=%ERRORLEVEL%"
  popd
  if not "%NPMFAIL%"=="0" goto :error
)

echo Compilando la API y la aplicacion...
call dotnet build "%REPO%\api\Madrid.Api.csproj" -v q --nologo
if errorlevel 1 goto :error
call dotnet build "%REPO%\desktop\Madrid.Desktop.csproj" -v q --nologo
if errorlevel 1 goto :error

echo Listo, abriendo la aplicacion.
start "" "%REPO%\desktop\bin\Debug\net10.0-windows\Madrid.Desktop.exe"

rem WebView2 no puede inicializarse con la sesion de Windows bloqueada: la
rem ventana muere al instante con COMException 0x8007139F. Si el proceso no
rem sigue vivo a los pocos segundos, avisamos en vez de dejar la pantalla vacia.
timeout /t 8 /nobreak >nul
tasklist /fi "imagename eq Madrid.Desktop.exe" | find /i "Madrid.Desktop.exe" >nul
if errorlevel 1 (
  echo.
  echo La ventana no se mantuvo abierta.
  echo Causa mas comun: la sesion de Windows estaba bloqueada. Desbloquea el
  echo equipo y vuelve a darle clic: la app levanta sola la API y el portal.
  pause
)
exit /b 0
:error
echo.
echo No se pudo compilar. Revisa el detalle de arriba.
pause
exit /b 1
