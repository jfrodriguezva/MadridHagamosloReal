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
3. **Antes de usar el botón "Actualizar datos"**: la propia app te avisa si
   falta la key con un botón "Falta tu API key — configurar" junto al botón
   de actualizar (en Inicio) — pégala ahí y se guarda sola en
   `{app}\scripts\.env` (endpoint `POST /api/admin/api-key`). Si prefieres
   hacerlo a mano: copia `.env.example` como `.env` en esa carpeta y pega tu
   key real de [api-football.com](https://www.api-football.com/).
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
- **SQL Server** (local o accesible) — es la fuente de verdad en desarrollo.
  La cadena de conexión (`ConnectionStrings:MadridDb`) **ya no vive en el
  código** (el repo es público) — configúrala una vez por máquina con
  `dotnet user-secrets set` desde `api/` (el proyecto ya tiene
  `UserSecretsId` en `Madrid.Api.csproj`):
  ```bash
  cd api
  dotnet user-secrets set "ConnectionStrings:MadridDb" "Server=localhost;Database=MadridHagamosloReal;User Id=sa;Password=TU_PASSWORD;TrustServerCertificate=True;"
  ```
  o exporta la variable de entorno `ConnectionStrings__MadridDb` con el mismo
  valor. Sin esto, `dotnet run` falla al arrancar con un `InvalidOperationException`
  que explica exactamente qué falta.
- (Opcional, solo si vas a re-entrenar el modelo o correr los scripts de
  carga histórica) **Python 3.12** + `pip install -r ml-service/requirements.txt`
  — esto es aparte del Python portátil que va DENTRO del instalador, ese no
  hace falta instalarlo tú.

### Restaurar la base de datos

Si tienes un `.bak` de SQL Server, restáuralo como `MadridHagamosloReal`. Si
no lo tienes (el caso más común al mover el proyecto a otro equipo — nos pasó
en esta misma máquina), un solo comando deja SQL Server (o SQL Express) con
el esquema **y** el histórico real, sin pasos manuales de por medio:

```powershell
.\ml-service\sql\bootstrap-dev-db.ps1
# instancia con nombre (típico en SQL Express): -Server ".\SQLEXPRESS"
# sin autenticación de Windows: -User sa -Password "..."
# solo el esquema, sin datos: -SchemaOnly
```

Hace dos cosas en un solo paso:
1. Crea la base (si no existe) y aplica los `00N_*.sql` en orden.
2. A menos que pases `-SchemaOnly`, la llena automáticamente con el
   histórico real desde `desktop/madrid.db` (mismo dataset que trae la app
   instalada) usando `ml-service/data/seed_dev_db_from_sqlite.py` — el
   Python ya viene en `ml-service/.venv` (committeado), no hace falta
   `pip install` para este flujo. Es **seguro correrlo varias veces**: tanto
   el esquema como los datos son idempotentes.

Después, guarda la cadena de conexión real con `dotnet user-secrets set`
desde `api/` (ver sección de arriba) — nunca la hardcodees en el código.

Alternativa si prefieres no tocar SQL Server para nada: apuntar la API
directo a `desktop/madrid.db` con SQLite:

```bash
cd api
DB_PROVIDER=sqlite SQLITE_PATH="../desktop/madrid.db" dotnet run --urls http://localhost:10001
```

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

Un solo comando hace los 4 pasos (build web → publish API → publish desktop →
compilar instalador):

```powershell
.\installer\build.ps1
```

Si cambiaste los puertos, pásale la URL correcta: `.\installer\build.ps1 -ApiUrl "http://localhost:10001"`.

El resultado queda en `installer/Output/MadridHagamosloReal-Setup.exe`.

<details>
<summary>Pasos manuales equivalentes (por si necesitas correr uno solo)</summary>

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
</details>

**Qué SÍ va dentro del instalable:** WPF+WebView2, API self-contained, build
de producción del web, `madrid.db` (SQLite con histórico), Python portátil
+ `db_sqlite.py` + `refresh_current.py` (para el botón "Actualizar datos")
+ `fetch_presser.py` (para el botón "Traer rueda de prensa", que no gasta
cuota de API-Football porque lee RSS públicos de buscadores), plantilla
`.env.example`.

**Qué NO va dentro (a propósito):** tu API key real (la pegas tú después de
instalar, en `.env`), el pipeline de entrenamiento de `ml-service/` (no hace
falta en runtime, solo para reentrenar el modelo), SQL Server (el instalable
es 100% SQLite).

### Sin Inno Setup: la versión portable

Los pasos 1-3 (web, API y escritorio) no necesitan Inno Setup — eso solo hace
falta para empaquetar el `.exe` de instalación. Copiando esas tres salidas con
el mismo mapeo que la sección `[Files]` del `.iss` queda una carpeta que la app
reconoce como **instalada** (`IsInstalled` en `MainWindow.xaml.cs` comprueba que
`api\Madrid.Api.exe` y `web\server.js` sean hermanos de `desktop\`), o sea con
SQLite y el botón "Actualizar datos" funcionando:

```
MadridHagamosloReal-portable\
  desktop\   <- desktop\bin\Release\net10.0-windows\win-x64\publish\*
  api\       <- api\publish\*
  web\       <- web\.next\standalone\*
  data\      <- desktop\madrid.db  (renombrado a data\madrid.db)
  runtime\   <- installer\runtime\node.exe + installer\runtime\python\
  scripts\   <- ml-service\data\{db_sqlite,refresh_current}.py + .env.example
  install-service.ps1, uninstall-service.ps1
```

Se ejecuta con `desktop\Madrid.Desktop.exe` y levanta sola API y portal. Pesa
~458 MB (el `.exe` del instalador comprime bastante más). Sirve para probar el
modo instalado sin instalar nada, pero para llevarla a otra máquina sigue
siendo preferible el instalador.

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

4. **La ventana no cabía en pantallas con escala de Windows.** El XAML pide
   `Height="900" Width="1400"`, pero eso son DIPs: en 1536x864 al 125% el
   área útil es 1229x653 DIPs. Con `WindowStartupLocation="CenterScreen"`, el
   centrado dejaba la barra de título ~124 DIPs POR ENCIMA del borde superior
   — la app quedaba sin botones de minimizar/maximizar/cerrar y sin nada de
   dónde arrastrarla. Arreglado en `MainWindow_SourceInitialized`, que ajusta
   el tamaño al área de trabajo real y recentra, más un menú en el ícono de
   bandeja (Mostrar / Maximizar / Minimizar / Centrar en pantalla / Salir) que
   sirve de rescate si la ventana vuelve a quedar inalcanzable.
   **Cuidado al tocar esto:** poner `WindowState = Maximized` dentro de
   `SourceInitialized` rompe WebView2 — su controlador se crea después, y
   falla con `COMException 0x8007139F` dejando la ventana en blanco. El
   maximizado inicial va en `MainWindow_Loaded`, ya con
   `EnsureCoreWebView2Async` completado.

5. **`seed_dev_db_from_sqlite.py` tronaba al reimportar el snapshot con un
   equipo/jugador/fixture nuevo.** `refresh_current.py` escribe siempre
   directo a SQLite (nunca a SQL Server, ver sección de arriba), y
   `export_to_sqlite.py` solo copia tipo de columna al generar el esquema de
   SQLite, no los `DEFAULT` de SQL Server. Como `CreatedAtUtc`/`IngestedAtUtc`/
   `FetchedAtUtc` son `NOT NULL DEFAULT SYSUTCDATETIME()` en SQL Server pero
   sin default en SQLite, un `INSERT` de `refresh_current.py` que no pasara
   ese valor dejaba la columna en `NULL` en `madrid.db` — inofensivo en
   SQLite, pero `seed_dev_db_from_sqlite.py` truena con violación de
   `NOT NULL` al reimportar esa fila a SQL Server. Pasaba típicamente con un
   rival de Champions nunca visto antes. Arreglado pasando
   `datetime.datetime.utcnow().isoformat()` explícito en los `INSERT` de
   `Leagues`, `Teams`, `Fixtures`, `Players` y `OddsSnapshots` dentro de
   `refresh_current.py` (las demás tablas que toca ese script — `MatchLineups`,
   `MatchLineupPlayers`, `MatchEvents2`, `MatchPlayerRatings` — no tienen
   columna de timestamp `NOT NULL`, no necesitan el fix).

6. **`desktop/madrid.db` estuvo commiteado vacío (0 tablas) desde el commit
   inicial del repo.** Se descubrió el 2026-09-14: tanto el commit inicial
   como el HEAD de esa fecha tenían un `madrid.db` de ~4.2MB pero sin ningún
   `CREATE TABLE` (`PRAGMA integrity_check` daba "ok" igual, así que no salta
   a la vista con una revisión superficial) — probablemente se commiteó justo
   después de que algo vació las tablas sin `VACUUM`. Nadie lo notó porque en
   desarrollo siempre se usa el archivo local real, nunca se vuelve a hacer
   `git checkout` de este archivo. Se corrigió commiteando la versión real
   (generada con `data/export_to_sqlite.py` desde SQL Server). **Si vuelves a
   ver `desktop/madrid.db` con 0 tablas después de un `git pull`/`checkout`,
   no es un bug nuevo — regenera con `export_to_sqlite.py` (o copia el
   `madrid.db` de una máquina donde sí tenga datos) antes de commitear otra
   vez.** Se descartó que sea corrupción por `core.autocrlf` (está en `true`
   y el archivo no tiene atributo binario en `.gitattributes`, pero
   `git hash-object` con y sin filtros da el mismo hash).

7. **`export_to_sqlite.py` tenía una lista de tablas desactualizada --
   `ValueBetLog` y `EpisodeMetrics` existían en SQL Server (migración
   `007_engagement.sql`) pero no estaban en `TABLES`, así que cada vez que
   se regeneraba `desktop/madrid.db` esas dos tablas simplemente
   desaparecían del snapshot (solo se recreaban vacías si la API en modo
   SQLite llegaba a arrancar y corría su `CREATE TABLE IF NOT EXISTS` de
   respaldo). Se descubrió el 2026-09-14 al verificar que el value bet
   recién resuelto (ver arriba) sobrevivía un `export_to_sqlite.py`. Si
   agregas una tabla nueva en SQL Server que también deba viajar al
   instalable, agrégala a `TABLES` (y a `IDENTITY_COLUMNS` si tiene
   `IDENTITY`) en `ml-service/data/export_to_sqlite.py` -- no se detecta
   sola.

Si reinstalas sobre una versión vieja y el servicio quedó mal registrado, no
hace falta reinstalar todo — basta con:
```powershell
Stop-Service MadridHagamosloRealApi
sc.exe delete MadridHagamosloRealApi
& powershell -ExecutionPolicy Bypass -File "C:\Program Files\MadridHagamosloReal\install-service.ps1"
```

---

## Robustez (backups, logs, tests)

**Backups automáticos.** La app de escritorio instalada copia `madrid.db` a
`%LOCALAPPDATA%\MadridHagamosloReal\Backups\madrid-YYYYMMDD-HHmmss.db` cada
vez que arranca, antes de levantar la API (`desktop/MainWindow.xaml.cs`,
`BackupDatabase()`). Guarda los últimos 14 backups y nunca bloquea el
arranque si falla. Para restaurar uno, cierra la app, reemplaza
`{app}\data\madrid.db` por el backup elegido, y vuelve a abrir.

**Logs.** La API loguea con Serilog a consola + archivo con rotación diaria
(14 días). En la app instalada (`DB_PROVIDER=sqlite`):
`%LOCALAPPDATA%\MadridHagamosloReal\Logs\api-YYYYMMDD.log`. En desarrollo
(`dotnet run` desde `api/`): `api/bin/Debug/net10.0/logs/api-YYYYMMDD.log`
(junto al `.dll`, porque ahí vive `AppContext.BaseDirectory` en ese modo).
Incluye logging de cada request (`UseSerilogRequestLogging`).

**Health check profundo.** `GET /api/health` ya no solo confirma que el
proceso .NET responde — corre `SELECT 1` contra la base configurada y
devuelve `503` con el detalle del error si la base no es alcanzable, en vez
de `200 OK` con una base vacía o inexistente por debajo (el bug real que ya
documentan los "Gotchas" de abajo).

**Tests.**
- `api.Tests/` — xUnit + `WebApplicationFactory<Program>` contra un SQLite
  temporal con datos sembrados a mano (no necesita SQL Server). Corre con
  `cd api.Tests && dotnet test`. Cubre accuracy/baseline, health check,
  disponibilidad de jugadores, el endpoint de transcripción (el `/api/media/
  transcribe` corre un proceso Python real, sin mocks, y fija el
  comportamiento honesto de hoy: falla claro si falta `faster-whisper`),
  tracking de value bets y métricas de episodios.
- `ml-service/tests/` — pytest sobre la matemática pura (el predictor Poisson
  de `compare_baseline_predictor.py` y `rps_3class`/`RESULT_TO_IDX` de
  `train_model.py`, incluyendo un test que protege contra el bug real ya
  resuelto de orden de clases alfabético) y el SQL de `PlayerAvailability`.
  Corre con:
  ```bash
  cd ml-service
  .venv/Scripts/python.exe -m pip install -r requirements-dev.txt
  .venv/Scripts/python.exe -m pytest tests/ -v
  ```

**CI (`.github/workflows/ci.yml`).** Los 19+ tests de arriba ahora corren
solos en cada push/PR a `main` — 3 jobs (`api-tests`, `web-checks`,
`ml-tests`) en `windows-latest` (el proyecto es intrínsecamente Windows;
Linux rompería con `node_modules`/`ml-service/.venv` committeados tal cual).
Revisa la pestaña Actions de GitHub después de pushear para confirmar que
pasó — no se puede verificar localmente más allá de que el YAML sea válido.

---

## Analista deportivo y creador de contenido

**Tracking de value bets.** `POST` implícito dentro de `/api/predictions/
next/value`: cada vez que la señal detecta valor (`hasValue=true`), guarda
un snapshot en `ValueBetLog` (se sobreescribe por partido, solo interesa el
último cálculo antes del kickoff). `GET /api/predictions/value-track-record`
compara esos snapshots contra `Predictions.ActualOutcome` una vez jugado el
partido — responde "¿esta señal de verdad ayuda?" con datos, no solo la
mostraba aislada. Visible en Predicción, debajo de la tarjeta de value bet.

**El value bet ya no se pierde si nadie abrió la pantalla antes del kickoff.**
Originalmente `ValueBetLog` solo se escribía como efecto secundario de que
alguien visitara `/api/predictions/next/value` en vivo -- si un partido se
jugaba sin que nadie abriera esa pantalla, el dato se perdía para siempre
aunque los momios (`OddsSnapshots`) y la predicción (`Predictions`) ya
estuvieran guardados de por sí. Se corrigió sin agregar ningún proceso en
background ni cron: la lógica de cálculo se extrajo a un helper
(`ComputeValueBetAsync` en `api/Program.cs`) que además de servir la
pantalla en vivo, se reutiliza para **rellenar retroactivamente** cualquier
partido ya jugado que tenga momios guardados pero ningún `ValueBetLog` --
se dispara solo, de forma perezosa, la próxima vez que alguien abre el
dashboard (`/api/matches/postmortem/last-match`) o la pantalla de historial
(`/api/predictions/value-track-record`), leyendo datos que ya estaban ahí.
No hace falta correr nada aparte ni recordarlo.

**Si el postmortem/value-track-record no se resuelven, la app avisa en
pantalla en vez de fallar en silencio.** El dashboard (`web/app/page.tsx`)
muestra un banner visible ("⚠ Datos sin actualizar") en la tarjeta de
postmortem cuando `Predictions.ActualOutcome` de ese partido sigue en
`NULL` -- explícitamente se decidió NO automatizar `persist_predictions.py`
en background para resolver esto (ver el flujo manual documentado arriba),
así que la app se limita a ser honesta sobre qué falta en vez de fingir que
ya está resuelto.

**El tablero de táctica (`/tactica`) ahora recuerda dónde pusiste a cada
jugador.** Antes solo guardaba la lista de titulares (`SlotPosition` era un
índice arbitrario `S0`, `S1`...); las coordenadas x/y que arma el usuario
arrastrando en el campo vivían solo en el estado de React y se perdían al
recargar. `UserLineupPlayers` tiene ahora columnas `X`/`Y` (migración
`ml-service/sql/009_lineup_coords.sql`, `FLOAT NULL`) y `POST /api/lineups`
las guarda; `GET /api/lineups/next` las devuelve y el frontend reconstruye
el acomodo exacto en vez de arrancar vacío.

**Tendencia de disparos.** `shotsTrend` en `/api/predictions/next/full` —
promedio de disparos al arco/totales a favor y en contra en los últimos 5
partidos con datos, desde `FixtureStatistics` (ya cargada). **No es xG
real** — API-Football no lo trae en el plan usado y no está en el esquema;
se etiqueta honestamente como "disparos" en la UI, nunca como "expected
goals".

**Vistas por episodio.** `POST /api/podcast/{id}/metrics` (`{viewsCount}`)
guarda una medición en `EpisodeMetrics` (varias por episodio permiten ver la
curva, no solo un número congelado); `GET /api/podcast/history` devuelve la
más reciente por episodio (`latestViews`). Se carga a mano desde la columna
"VISTAS" del histórico en Podcast — no hay integración con YouTube
Analytics. Igual que `PlayerAvailability`, la tabla se crea sola en SQLite
la primera vez que se guarda una medición.

**Postmortem del último partido.** `GET /api/matches/postmortem/last-match`
junta en una sola llamada lo que antes vivía repartido en cuatro endpoints
(predicción vs. `Predictions.ActualOutcome`, `ValueBetLog` vs. resultado,
MVP/peor calificado de `MatchPlayerRatings`, y el delta promedio entre
`UserPlayerRatings` y la IA para ese partido) — responde de un vistazo
"¿acertamos, valió la pena el value bet, quién fue el MVP y qué tan de
acuerdo estuvo el usuario con la IA?" sin cruzar mentalmente cuatro
pantallas. Visible en el dashboard (`/`), debajo del KPI strip.

**Importante — el postmortem no se llena solo.** `refresh_current.py` (el
botón "Actualizar datos") trae el marcador final a `Fixtures` pero **nunca
toca `Predictions.ActualOutcome`/`WasCorrect`** — por diseño no depende de
SQL Server ni del pipeline de entrenamiento. Quien resuelve si la predicción
acertó es `ml-service/train/persist_predictions.py`, que solo corre contra
SQL Server (`data/db.py`, no `db_sqlite.py`). El orden correcto después de
que se jugó un partido, en desarrollo:

```bash
cd ml-service
.venv/Scripts/python.exe data/refresh_current.py   # o el botón "Actualizar datos" -> madrid.db
# asegúrate de que SQL Server ya tenga ese fixture con marcador final
# (bootstrap-dev-db.ps1 reseedea desde madrid.db si hace falta)
.venv/Scripts/python.exe train/persist_predictions.py   # backfill ActualOutcome/WasCorrect + repredice próximos partidos
.venv/Scripts/python.exe data/export_to_sqlite.py        # empuja Predictions actualizado de vuelta a desktop/madrid.db
```

Sin el segundo y tercer paso, el dashboard sigue mostrando ese partido como
"pendiente de resolver" en el postmortem y en `value-track-record` aunque el
marcador ya esté cargado. En la app instalada (100% SQLite, sin SQL Server)
este backfill no existe todavía — el postmortem de un partido recién jugado
en la app instalada se queda sin resolver hasta que alguien lo corra en dev
y reexporte `madrid.db`.

`train_model.py` valida con walk-forward sobre `TEST_SEASONS` (hoy incluye
hasta 2026) — cada vez que arranca una temporada nueva hay que agregar su
año a esa lista antes de reentrenar, o `persist_predictions.py` no generará
predicciones OOF para los partidos de esa temporada.

---

## Generación automática de contenido y transcripción

**Videos/imágenes desde datos reales (sin edición manual).** En la pestaña
Podcast → Contenido, tres botones generan piezas listas para publicar, cada
uno consultando `/api/matches/{id}/detail` y `/api/matches/{id}/mvp`:
- **Generar video automático** (`AutoVideoGenerator.tsx`) — video vertical
  con varias escenas (resultado, goleadores, MVP, talking points) y
  transición `xfade`.
- **Generar clips por gol** (`GoalClips.tsx`) — un video corto (~3.5s) por
  cada gol del Real Madrid, listo para Reels/Shorts/TikTok.
- **Generar infografía automática** (`AutoInfographic.tsx`) — una sola
  imagen cuadrada (1080×1080) con marcador, goleadores y figura del partido.

Los tres dibujan en `<canvas>` y, para video, codifican con `ffmpeg.wasm` —
mismo patrón, 100% local, sin llamar a ningún servicio externo.

**Transcripción local (voz-a-texto).** En el editor de video, el botón
"Transcribir audio" extrae el audio de tu grabación con `ffmpeg.wasm`
(comprimido, no sube el video completo) y lo manda a `POST
/api/media/transcribe`, que corre `ml-service/data/transcribe.py`
(`faster-whisper`, 100% local, sin API key) y devuelve el texto para pegar
en la descripción de YouTube. Funciona en los dos entornos:

- **App instalada** — `faster-whisper` ya viene en `installer/runtime/python/`
  (agregado con `pip install faster-whisper==1.0.3` contra ese intérprete
  portátil antes de compilar), y `transcribe.py` se copia a
  `{app}\scripts\` vía `MadridHagamosloReal.iss`. No hace falta ningún paso
  extra del usuario.
- **Desarrollo** — usa `ml-service/.venv`, que necesita el paquete a mano:
  ```bash
  cd ml-service
  .venv/Scripts/python.exe -m pip install -r requirements-transcribe.txt
  ```

El endpoint resuelve el intérprete con el mismo criterio que `StartPythonScript`
(`PYTHON_EXE`/`SCRIPTS_DIR` → layout instalado → venv de `ml-service` como
último recurso), así que no hace falta configurar nada para que funcione en
cualquiera de los tres casos. La primera transcripción descarga el modelo
(~150MB, modelo "small") desde Hugging Face una sola vez; de ahí en
adelante funciona sin internet. Esto agrega ~200-300MB al instalador.

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
  script liviano de actualización (`data/refresh_current.py`, 7 pasos:
  fixtures, alineaciones/eventos, calificaciones, plantilla, momios y
  **bajas/sanciones** — este último crea su propia tabla `PlayerAvailability`
  la primera vez que corre, incluso en una app ya instalada. Compatible con
  SQLite vía `db_sqlite.py`, es el que corre el botón "Actualizar datos").
- `installer/` — script de Inno Setup + el Python portátil ya extraído en
  `runtime/python/`.
