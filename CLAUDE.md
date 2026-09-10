# Madrid Hagámoslo Real

Herramienta **personal** de análisis/predicción/apoyo de contenido y podcast,
**exclusivamente sobre el Real Madrid**. No es un portal de fans multi-equipo
ni un producto público — cada feature se evalúa contra "¿esto ayuda a generar
contenido/análisis del Real Madrid para el podcast del usuario?". No propongas
expandir a otros equipos/ligas ni features de "portal genérico".

Ver también [RECOVERY.md](RECOVERY.md) para cómo levantar el entorno,
recompilar el instalador, y los puertos/arquitectura.

## Reglas de negocio establecidas (no las repitas ni las cuestiones sin que el usuario las cambie)

**Persistencia de datos**: todo lo que se consulta de API-Football (fixtures,
lineups, eventos, calificaciones IA, momios, plantilla) se guarda en la base
de datos (SQL Server en dev, SQLite en la app instalada) vía scripts
idempotentes en `ml-service/data/`. La API y el frontend **nunca** llaman a
API-Football directamente — solo leen de la base local. Motivo: cuota de la
API limitada y se quiere un dataset propio y durable.

**El modelo de ML ya es "suficientemente bueno"**: ensemble XGBoost+Poisson,
~67.6-67.9% accuracy en 1X2 con validación walk-forward real (nunca k-fold).
El usuario está conforme y prefiere mejorarlo él mismo más adelante con sus
propios estadísticos revisados. Por defecto, ante este tema, prioriza trabajo
de producto/features sobre perseguir más accuracy — a menos que el usuario
pida explícitamente trabajo de modelo.

**El editor de imágenes NO usa IA externa, por decisión explícita del
usuario** (rechazó integrar OpenAI/Gemini/Stability/etc. porque requeriría su
propia API key y billing). Es un editor de pixeles real y local (`<canvas>`
de verdad, no filtros CSS ni un parser de palabras clave fingiendo ser IA):
pincel de brillo, pincel "ocultar" (blur local), sello clonador, deshacer,
filtros globales. Si se pide "mejorar" esto sin que el usuario dé una API
key, se agregan más herramientas manuales de precisión — nunca se simula
comprensión de texto libre otra vez.

**Exportar imágenes/gráficos**: usar Canvas 2D nativo (`drawImage`,
`fillText`, `toDataURL`), nunca librerías de captura de DOM tipo
`html-to-image`/`html2canvas` — se cuelgan indefinidamente en este entorno
(WebView2/preview sandbox) sin error visible.

**Editor de video**: es un editor real con `ffmpeg.wasm` auto-hospedado en
`web/public/ffmpeg/` (funciona offline, sin CDN) — overlays de imagen/video/
texto/audio sobre el video base, no un mockup. Dos gotchas ya resueltos que
no hay que redescubrir:
- Una imagen en loop (`-loop 1 -i img.png`) sin `-t <duración>` explícito
  cuelga `ffmpeg.exec()` para siempre si se compone con `overlay` contra un
  video base finito (`-shortest` en el output NO lo arregla).
- Referenciar `[0:a]`/`-map 0:a` cuando el video base no tiene pista de audio
  falla — usar `-map 0:a?` (opcional) o el patrón try/catch-reintentar-sin-audio
  cuando sí se mezclan pistas nuevas con `amix`.

**Generación automática de contenido desde datos reales**: `AutoVideoGenerator.tsx`
(video vertical con escenas tipo historia), `GoalClips.tsx` (un clip corto por
gol, para Reels/Shorts/TikTok) y `AutoInfographic.tsx` (imagen cuadrada única)
comparten el mismo patrón: dibujan tarjetas en `<canvas>` con datos reales de
`/api/matches/{id}/detail` y `/api/matches/{id}/mvp`, y para video las
codifican con `ffmpeg.wasm` (secuencia de imágenes → mp4, con `xfade` para
transiciones cuando hay varias escenas). Nunca usan una plantilla con datos
inventados — si un dato no está (ej. sin MVP calificado todavía), la tarjeta
lo dice explícitamente en vez de omitirlo en silencio.

**Transcripción de voz-a-texto**: igual que el editor de imagen, **sin IA
externa de pago** — usa `faster-whisper` corriendo 100% local
(`ml-service/data/transcribe.py`), no la API de OpenAI. Hoy es **solo para
desarrollo** (usa `ml-service/.venv`, el usuario instala `faster-whisper` a
mano con `requirements-transcribe.txt` porque es una dependencia pesada) —
todavía no está en el Python portátil del instalador. Si se pide llevarlo a
la app instalada, hay que evaluar el tamaño que le suma al instalador antes
de hacerlo, no asumir que es gratis en espacio.

**Gotcha de .NET 10**: cualquier endpoint Minimal API que reciba `IFormFile`
exige metadata de antiforgery aunque nunca se llame a `AddAntiforgery()` —
sin `.DisableAntiforgery()` en el endpoint, truena con
`InvalidOperationException` en la primera request real (ver
`/api/media/transcribe` en `api/Program.cs`). Ya se resolvió una vez, no
hay que redescubrirlo si se agrega otro endpoint de subida de archivos.
**Rueda de prensa previa (Podcast → Contenido)**: API-Football no expone
ruedas de prensa. Los temas viven en `PressConferences`/`PressTopics` ligados
al próximo fixture y entran por cuatro vías, distinguidas por `Source`:
`oficial` (la sala de prensa de realmadrid.com, transcripción de primera
mano), `buscador` (notas de medios vía el RSS de noticias de Bing), `claude`
(yo investigo la rueda cuando el usuario me lo pide y la escribo por
`POST /api/press/manual`) y `manual` (el usuario la teclea viendo la rueda).
Las dos primeras las trae `api/PressFetcher.cs`, que extrae las **citas
entrecomilladas** por estructura —nunca por "entender" el texto— y guarda la
cita literal con medio, titular y link. La app **nunca titula el tema ni
decide cuál es "el más relevante"**: eso lo hace el usuario marcando temas,
igual que la regla del editor de imágenes. El guion de la previa cruza los
temas marcados con la predicción del modelo.

Va en C# dentro de la API, no como script de Python en `ml-service/data/`,
a propósito: no consume cuota de API-Football ni credenciales, así que el
botón funciona igual en desarrollo y en la app instalada sin depender de que
haya un intérprete de Python en la máquina (la regla de "todo lo de
API-Football pasa por scripts idempotentes de Python" sigue vigente para
fixtures, alineaciones, momios y plantilla — esto no es API-Football).

**Grabación local (Podcast → Grabar local)**: dos modos, por una razón de
producto — al grabar la pizarra **no debe salir el resto de la app**.
- Modo `app`: `getDisplayMedia({preferCurrentTab:true})` + **Region Capture**
  (`CropTarget.fromElement` + `track.cropTo`) recortando al `<iframe>` de la
  sección. El recorte es a nivel de compositor: la navbar, los controles del
  grabador y el indicador flotante de "grabando" **no existen en el video**
  aunque estén en pantalla. El track ya viene recortado, así que se graba
  directo sin pasar por canvas. Si el navegador no soporta Region Capture se
  avisa en pantalla — nunca se graba de más en silencio.
- Modo `pantalla`: para otra ventana (la transmisión del partido, otra web).
  `selfBrowserSurface:"exclude"` saca la propia pestaña del selector, y el
  rectángulo que arrastra el usuario se dibuja en un `<canvas>` a 30fps
  (Canvas 2D nativo, coherente con la regla de exportación). El recuadro se
  puede mover en vivo sin cortar la toma.

El control de grabación es un indicador flotante fijo estilo iPhone
(`createPortal` a `document.body`): cronómetro, nivel de micrófono, pausa y
detener, siempre alcanzable sin volver a la pestaña y fuera del recorte, así
que no se graba a sí mismo. El micrófono se concede en
`desktop/MainWindow.xaml.cs` (`PermissionRequested`), solo para el origen
local y solo micrófono; la captura usa el selector por defecto de WebView2
(no hace falta manejar `ScreenCaptureStarting`).

**Selección de archivos en la app WPF**: WebView2 es Chromium — un
`<input type="file">` normal ya abre el picker nativo de Windows sin código
extra. No construyas un puente nativo custom (`window.chrome.webview.postMessage`)
para esto; ya se intentó, era la pieza más frágil y nunca probada, y se quitó
por completo. Solo usa el puente nativo para algo que la web de verdad no
pueda hacer (ej. `NotifyIcon` para notificaciones nativas de Windows, que sí
sigue en uso).

## Estado de la migración SQLite / instalador

**Terminado.** La API (`api/Program.cs`) soporta SQL Server (dev, por
defecto) y SQLite (app instalada) vía `DB_PROVIDER`. El instalador (Inno
Setup, `installer/MadridHagamosloReal.iss`) compila en
`installer/Output/MadridHagamosloReal-Setup.exe` y quedó **probado en una
máquina nueva real** (no solo en este equipo de desarrollo) — incluyendo el
botón "Actualizar datos" (llama a API-Football vía un Python portátil
embebido, solo en la app instalada, disparado manualmente por el usuario,
nunca en automático, para no gastar cuota sin querer).

Detalle completo de arquitectura, puertos, cómo recompilar el instalador, y
los 3 bugs reales ya resueltos (WebView2 en Program Files, servicio de
Windows, rutas de `install-service.ps1`) está en [RECOVERY.md](RECOVERY.md)
— léelo antes de tocar el instalador o el flujo de "app instalada".
