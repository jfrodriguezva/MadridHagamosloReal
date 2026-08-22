# Instalador — Madrid Hagámoslo Real (versión personal)

## Lo que ya existe y corre hoy

- **`desktop/`** — app WPF (`Madrid.Desktop`) con WebView2 embebido. Al abrir:
  detecta si el API (puerto 5080) y el portal Next.js (puerto 3000) ya están
  corriendo; si no, los arranca ella misma como procesos hijo, espera a que
  respondan, y navega el WebView2 a `http://localhost:3000`. Al cerrar la
  ventana, mata los procesos que ella misma arrancó.
- **`ml-service/data/export_to_sqlite.py`** — exporta toda la base de SQL
  Server a `desktop/madrid.db` (SQLite de archivo único). Ya corrido: 6,593
  partidos, 28,772 filas de alineación, 10,225 eventos, todo verificado.
- **`installer/install-service.ps1`** / **`uninstall-service.ps1`** —
  instalan/quitan el API como Servicio de Windows.
- **`installer/MadridHagamosloReal.iss`** — script de Inno Setup para el
  instalador "siguiente, siguiente, terminar".

## Lo que falta -- y por qué no lo hice sin preguntarte

### 1. El API todavía habla SQL Server, no SQLite

`madrid.db` existe y tiene todos los datos, pero el API (`Program.cs`) sigue
usando sintaxis específica de T-SQL en cada endpoint (`MERGE`, `TOP N`,
`SYSUTCDATETIME()`, `DATETIME2`) que SQLite no entiende igual. Adaptar esto
significa tocar los ~20 endpoints uno por uno y volver a probar cada uno --
es exactamente el tipo de cambio grande que, si lo hago a las carreras,
arriesga romper algo que ya está funcionando y demostrado hoy. Lo dejo como
la próxima tarea dedicada, no a medias.

**Camino recomendado**: usar `Microsoft.Data.Sqlite` en vez de
`Microsoft.Data.SqlClient`, y una capa `IDbConnectionFactory` que decida en
tiempo de ejecución (SQL Server para desarrollo/producción web, SQLite para
la versión personal) -- así el mismo código de negocio sirve a los dos
motores sin duplicar endpoints. Es justo el patrón que ya mencionaste que
quieres (Next.js + API primero, para que sea rápido llegar a web/app móvil
después).

### 2. No instalé el servicio de Windows yo mismo

Registrar un servicio de Windows modifica la configuración del sistema
operativo (Panel de Servicios) de forma persistente -- corre en cada
arranque de Windows, con o sin que abras la app. Es un cambio de los que
debes ejecutar tú, no algo que un asistente deba hacer en automático.
`install-service.ps1` ya está escrito y listo -- ábrelo con PowerShell como
Administrador cuando quieras instalarlo.

### 3. No compilé el instalador `.exe`

Compilar `MadridHagamosloReal.iss` requiere tener instalado Inno Setup
(gratis, de terceros) -- descargar e instalar software nuevo en tu máquina
es otra decisión que te dejo a ti. Una vez lo instales, compilar es abrir
el `.iss` y presionar "Compile".

## Cómo probar lo que sí está listo ahora

```bash
cd desktop
dotnet build
./bin/Debug/net10.0-windows/Madrid.Desktop.exe
```

Si el API y el portal ya están corriendo (como en esta sesión), la ventana
WPF se conecta directo. Si no, los arranca sola.
