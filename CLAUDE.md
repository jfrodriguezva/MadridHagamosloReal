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
