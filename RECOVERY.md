# Recuperar el proyecto en otro equipo

Guía rápida para cuando muevas esta carpeta completa a otra máquina. Hay dos
caminos: **instalar la app ya compilada** (rápido, recomendado si solo vas a
usarla) o **levantar el entorno de desarrollo completo** (si vas a seguir
programando ahí).

Si llegaste aquí desde una carpeta `Hagamoslo-Handoff\` (una copia liviana
para trasladar el proyecto), corre primero `bootstrap.ps1` en la raíz — te
reinstala `node_modules`, hace `dotnet restore` de `api` y `desktop`, y te
dice qué falta. Esa carpeta excluye a propósito `node_modules`, `bin`, `obj`,
`.next` y `ml-service/.venv` (todo regenerable) para que la copia sea rápida.

## Puertos (importante)

Desde este cambio, tanto en desarrollo como en la app instalada se usan los
mismos puertos altos, para no chocar con otros proyectos en el equipo:

- **Web (Next.js):** `10000`
- **API (.NET):** `10001`

Si algún día cambias estos puertos, hay que tocar en 3 sitios a la vez:
`web/package.json` (scripts `dev`/`start`), `api/Program.cs` (política CORS,
línea ~11, debe incluir el origin del web) y `desktop/MainWindow.xaml.cs`
(constantes `WebPort`/`ApiPort`).

---

## Camino A — Solo instalar la app (recomendado)

No necesitas Node, .NET SDK, ni SQL Server en el equipo nuevo.

1. Copia `installer/Output/MadridHagamosloReal-Setup.exe` al equipo nuevo
   (o cópialo junto con toda la carpeta del proyecto).
2. Ejecútalo como Administrador. Te va a ofrecer instalar el servicio de
   Windows del API (recomendado) y abrir la app al terminar.
3. **Antes de usar el botón "Actualizar datos"**: ve a la carpeta de
   instalación (`{app}\scripts`), copia `.env.example` como `.env` y pega ahí
   tu API key real de [api-football.com](https://www.api-football.com/).
   Sin esto el botón falla con un mensaje claro pidiendo la key.
4. La app usa SQLite (el archivo `madrid.db` que trae el instalador con todo
   el histórico ya cargado) — no necesita SQL Server en esa máquina.

Si el `.exe` del instalador no está a mano pero sí el resto del proyecto,
puedes recompilarlo (ver "Recompilar el instalador" más abajo) siempre que
tengas Inno Setup 6 instalado.

---

## Camino B — Entorno de desarrollo completo

Requiere en el equipo nuevo:

- **.NET SDK 10** (`dotnet --version` → `10.0.400` o similar)
- **Node.js** v20+ (se probó con v24) y npm
- **SQL Server** (local o accesible) — es la fuente de verdad en desarrollo;
  la cadena de conexión por defecto está en `api/Program.cs` (~línea 39,
  `ConnectionStrings:MadridDb` o el fallback embebido) — ajústala si tu SQL
  Server tiene otro usuario/password/instancia.
- (Opcional, solo si vas a re-entrenar el modelo o correr los scripts de
  carga histórica) **Python 3.12** + `pip install -r ml-service/requirements.txt`
  — esto es aparte del Python portátil que va DENTRO del instalador, ese no
  hace falta instalarlo tú.

### Restaurar la base de datos

Si tienes un `.bak` de SQL Server, restáuralo como `MadridHagamosloReal`. Si
no, `desktop/madrid.db` es un snapshot en SQLite con todo el histórico — se
puede usar como referencia, pero el flujo normal de desarrollo asume SQL
Server.

### Instalar dependencias y levantar los 3 procesos

```bash
cd web && npm install
```

En 3 terminales separadas (quedan corriendo en primer plano):

```bash
cd api && dotnet run --urls http://localhost:10001
```
```bash
cd web && npm run dev
```
```bash
cd desktop && dotnet run
```

El orden recomendado es API → Web → Desktop. La app WPF detecta sola si ya
están corriendo (no los vuelve a levantar) y si no, los arranca ella misma en
modo dev (ver `desktop/MainWindow.xaml.cs`, métodos `EnsureApiRunning` /
`EnsureWebRunning`).

---

## Recompilar el instalador (si cambiaste código)

Necesitas [Inno Setup 6](https://jrsoftware.org/isinfo.php) instalado
(`ISCC.exe`, normalmente en
`%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe`).

```bash
# 1. Build de producción del web (con la URL correcta de la API horneada adentro)
cd web
NEXT_PUBLIC_API_URL=http://localhost:10001 npm run build
cp -r public .next/standalone/
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static

# 2. Publicar la API self-contained
cd ../api
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish

# 3. Publicar la app de escritorio (WPF)
cd ../desktop
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true \
  -o bin/Release/net10.0-windows/win-x64/publish

# 4. Compilar el instalador
cd ../installer
"$LOCALAPPDATA/Programs/Inno Setup 6/ISCC.exe" MadridHagamosloReal.iss
```

El resultado queda en `installer/Output/MadridHagamosloReal-Setup.exe`.

**Qué SÍ va dentro del instalable:** WPF+WebView2, API self-contained, build
de producción del web, `madrid.db` (SQLite con histórico), Python portátil
+ `db_sqlite.py` + `refresh_current.py` (para el botón "Actualizar datos"),
plantilla `.env.example`.

**Qué NO va dentro (a propósito):** tu API key real (la pegas tú después de
instalar, en `.env`), el pipeline de entrenamiento de `ml-service/` (no hace
falta en runtime, solo para reentrenar el modelo), SQL Server (el instalable
es 100% SQLite).

---

## Gotchas ya resueltos (no los repitas)

Tres bugs reales que aparecieron probando el instalador en una máquina nueva
de verdad, ya arreglados en el código — quedan aquí para no perder tiempo
redescubriéndolos si algo similar reaparece:

1. **WebView2 no puede escribir en Program Files.** Por defecto WebView2
   crea su carpeta de datos junto al `.exe`; si la app está instalada en
   `Program Files` y corre sin privilegios de admin, falla con "No se pudo
   crear el directorio de datos". Arreglado en
   `desktop/MainWindow.xaml.cs` (`MainWindow_Loaded`): se le pasa un
   `CoreWebView2Environment` explícito apuntando a
   `%LOCALAPPDATA%\MadridHagamosloReal\WebView2` (siempre escribible).
2. **El servicio de Windows del API no arrancaba.** Un `.exe` de consola
   normal no entiende el protocolo del Administrador de Servicios (SCM) —
   `New-Service` + `Start-Service` fallaba con error de handshake/timeout.
   Arreglado agregando el paquete `Microsoft.Extensions.Hosting.WindowsServices`
   y `builder.Services.AddWindowsService(...)` en `api/Program.cs`.
3. **`install-service.ps1` apuntaba a rutas equivocadas.** El script asumía
   que corría desde una subcarpeta, pero el instalador lo copia a la raíz de
   la instalación (`{app}\install-service.ps1`). Sus valores por defecto
   (`$PSScriptRoot\..\api\publish`, `$PSScriptRoot\..\data\madrid.db`)
   apuntaban un nivel arriba de donde realmente están los archivos — el
   servicio arrancaba "Running" pero abría una base de datos vacía/inexistente
   (portal cargaba sin datos). Arreglado a `$PSScriptRoot\api` y
   `$PSScriptRoot\data\madrid.db`.

Si reinstalas sobre una versión vieja y el servicio quedó mal registrado, no
hace falta reinstalar todo — basta con:
```powershell
Stop-Service MadridHagamosloRealApi
sc.exe delete MadridHagamosloRealApi
& powershell -ExecutionPolicy Bypass -File "C:\Program Files\MadridHagamosloReal\install-service.ps1"
```

---

## Referencia rápida de la arquitectura

- `web/` — Next.js 15 (frontend), server components leen la API por SSR y
  algunos componentes cliente (ej. `RefreshDataButton.tsx`) la llaman desde
  el navegador — por eso la API necesita CORS abierto al origin del web
  (`api/Program.cs`, política CORS).
- `api/` — .NET minimal API + Dapper. `DB_PROVIDER=sqlite|sqlserver` decide
  el motor; en dev es `sqlserver` por defecto, en el instalable es `sqlite`.
- `desktop/` — WPF + WebView2, solo un shell nativo que navega al web y
  agrega notificaciones de próximo partido + selector de archivos nativo
  para los editores de video/imagen del podcast.
- `ml-service/` — Python: entrenamiento del modelo (`train/`), scripts de
  carga histórica (`data/fetch_*.py`, requieren SQL Server + pyodbc) y el
  script liviano de actualización (`data/refresh_current.py`, compatible
  con SQLite vía `db_sqlite.py`, es el que corre el botón "Actualizar datos").
- `installer/` — script de Inno Setup + el Python portátil ya extraído en
  `runtime/python/`.
