using System.Data;
using Dapper;
using Microsoft.Data.Sqlite;
using Microsoft.Data.SqlClient;
using Serilog;

// Log a archivo con rotación diaria, además de consola -- antes, si algo fallaba en la
// app instalada (sin consola visible, corriendo como servicio de Windows), no había
// forma de ver qué pasó sin reproducir el bug a mano. En instalado va a %LOCALAPPDATA%
// (siempre escribible, mismo criterio que WebView2 en MainWindow.xaml.cs del desktop);
// en desarrollo, a ./logs junto al proyecto.
// DB_PROVIDER llega por env var (lanzado desde el desktop) o por --DB_PROVIDER=sqlite
// (servicio de Windows, ver install-service.ps1) -- se chequea temprano y aparte de la
// lógica de conexión de más abajo porque el logger se arma antes que "builder".
var dbProviderForLogs = Environment.GetEnvironmentVariable("DB_PROVIDER")
    ?? args.FirstOrDefault(a => a.StartsWith("--DB_PROVIDER=", StringComparison.OrdinalIgnoreCase))?[14..]
    ?? "sqlserver";
var logDir = dbProviderForLogs.Equals("sqlite", StringComparison.OrdinalIgnoreCase)
    ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MadridHagamosloReal", "Logs")
    : Path.Combine(AppContext.BaseDirectory, "logs");
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft.AspNetCore", Serilog.Events.LogEventLevel.Warning)
    .WriteTo.Console()
    .WriteTo.File(Path.Combine(logDir, "api-.log"), rollingInterval: RollingInterval.Day, retainedFileCountLimit: 14)
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog();

// El default de Kestrel (~28MB) alcanza para las cargas normales de la app, pero se queda
// corto para el audio que sube /api/media/transcribe -- el frontend ya lo extrae/comprime
// con ffmpeg.wasm antes de subirlo, pero un episodio largo aun así puede pasar de eso.
// App local de un solo usuario -- un límite generoso no es un riesgo real.
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 500L * 1024 * 1024);

// Permite que este mismo .exe corra como Servicio de Windows real (instalado
// vía install-service.ps1) además de como consola normal en desarrollo --
// sin esto, el Administrador de Servicios no puede iniciarlo (nunca hace el
// handshake que espera) y falla con "no se puede iniciar el servicio".
builder.Services.AddWindowsService(options =>
{
    options.ServiceName = "MadridHagamosloRealApi";
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:10000", "http://localhost:3000", "http://localhost:3001")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

const int RealMadridId = 541;

// DB_PROVIDER=sqlite activa el motor local (usado por la app instalable de escritorio);
// por defecto sigue en SQL Server, la fuente de verdad durante desarrollo.
var dbProvider = builder.Configuration["DB_PROVIDER"] ?? Environment.GetEnvironmentVariable("DB_PROVIDER") ?? "sqlserver";
bool isSqlite = dbProvider.Equals("sqlite", StringComparison.OrdinalIgnoreCase);

// Helpers de dialecto: SQL Server usa TOP (n), SQLite usa LIMIT n al final de la consulta.
string Top(int n) => isSqlite ? "" : $"TOP ({n})";
string Limit(int n) => isSqlite ? $"LIMIT {n}" : "";
string TopP(string param) => isSqlite ? "" : $"TOP ({param})";
string LimitP(string param) => isSqlite ? $"LIMIT {param}" : "";

var sqlitePath = builder.Configuration["SQLITE_PATH"] ?? Environment.GetEnvironmentVariable("SQLITE_PATH") ?? "madrid.db";

if (isSqlite)
{
    var sqliteConnString = $"Data Source={sqlitePath}";
    builder.Services.AddSingleton<Func<IDbConnection>>(() => new SqliteConnection(sqliteConnString));
}
else
{
    // Nunca hardcodear la cadena de conexión real aquí -- este repo es público.
    // En desarrollo: `dotnet user-secrets set "ConnectionStrings:MadridDb" "Server=...;Password=...;"`
    // dentro de api/ (ya inicializado, ver <UserSecretsId> en Madrid.Api.csproj). También se puede
    // pasar por la variable de entorno ConnectionStrings__MadridDb.
    var connString = builder.Configuration.GetConnectionString("MadridDb")
        ?? throw new InvalidOperationException(
            "Falta ConnectionStrings:MadridDb. Configúrala con 'dotnet user-secrets set " +
            "\"ConnectionStrings:MadridDb\" \"Server=localhost;Database=MadridHagamosloReal;User Id=...;Password=...;TrustServerCertificate=True;\"' " +
            "desde la carpeta api/, o con la variable de entorno ConnectionStrings__MadridDb.");
    builder.Services.AddSingleton<Func<IDbConnection>>(() => new SqlConnection(connString));
}

var app = builder.Build();

app.UseCors();
app.UseSerilogRequestLogging();

// Racha de forma reciente (W/D/L) del Real Madrid, en orden cronológico (más viejo -> más
// nuevo) para leerse como una línea de tiempo. Reutilizada por dashboard/next-match y por
// predictions/next/full -- un solo lugar que sabe calcular "racha" en vez de duplicar el SQL.
async Task<List<string>> RecentForm(IDbConnection conn, int count = 5)
{
    var rows = await conn.QueryAsync<dynamic>(
        $"""
        SELECT {Top(count)} HomeTeamId AS homeTeamId, AwayTeamId AS awayTeamId, HomeGoals AS homeGoals, AwayGoals AS awayGoals
        FROM Fixtures
        WHERE (HomeTeamId = @rm OR AwayTeamId = @rm) AND StatusShort = 'FT'
        ORDER BY KickoffUtc DESC
        {Limit(count)}
        """, new { rm = RealMadridId });

    string Outcome(dynamic r)
    {
        bool rmHome = (int)r.homeTeamId == RealMadridId;
        int rmGoals = rmHome ? (int)r.homeGoals : (int)r.awayGoals;
        int oppGoals = rmHome ? (int)r.awayGoals : (int)r.homeGoals;
        return rmGoals > oppGoals ? "W" : rmGoals < oppGoals ? "L" : "D";
    }

    return rows.Select(r => Outcome(r)).Reverse().ToList();
}

// Chequeo profundo: antes solo confirmaba que el proceso .NET respondía, no que la
// base de datos configurada era alcanzable -- exactamente el hueco que causó el bug
// ya documentado en RECOVERY.md (servicio "Running" con DB vacía/inexistente, portal
// cargaba sin datos y sin ningún error visible). 503 en vez de 200 cuando la DB falla
// para que cualquier chequeo externo (o el propio shell de escritorio) lo note de una.
app.MapGet("/api/health", async (Func<IDbConnection> factory) =>
{
    try
    {
        using var conn = factory();
        await conn.ExecuteScalarAsync<int>("SELECT 1");
        return Results.Ok(new { status = "ok", db = "ok" });
    }
    catch (Exception ex)
    {
        return Results.Json(new { status = "degraded", db = "error", detail = ex.Message }, statusCode: 503);
    }
});

// Nota: Dapper devuelve <dynamic> como diccionarios que preservan el alias
// SQL tal cual -- por eso los alias van en camelCase aquí, para que el JSON
// que consume Next.js no necesite un mapeo de propiedades aparte.
app.MapGet("/api/dashboard/next-match", async (Func<IDbConnection> factory) =>
{
    using var conn = factory();
    var match = await conn.QuerySingleOrDefaultAsync<dynamic>(
        $"""
        SELECT {Top(1)} f.FixtureId AS fixtureId, f.KickoffUtc AS kickoffUtc, f.RoundLabel AS roundLabel,
               ht.Name AS homeTeam, ht.TeamId AS homeTeamId,
               at.Name AS awayTeam, at.TeamId AS awayTeamId,
               p.ProbHome AS probHome, p.ProbDraw AS probDraw, p.ProbAway AS probAway
        FROM Fixtures f
        JOIN Teams ht ON f.HomeTeamId = ht.TeamId
        JOIN Teams at ON f.AwayTeamId = at.TeamId
        LEFT JOIN Predictions p ON p.FixtureId = f.FixtureId AND p.Market = '1X2' AND p.ActualOutcome IS NULL
        WHERE (f.HomeTeamId = @rm OR f.AwayTeamId = @rm) AND f.StatusShort = 'NS'
        ORDER BY f.KickoffUtc ASC
        {Limit(1)}
        """, new { rm = RealMadridId });

    if (match is null) return Results.NotFound();

    var recentForm = await RecentForm(conn);
    var result = (IDictionary<string, object>)match!;
    result["recentForm"] = recentForm;
    return Results.Ok(result);
});

app.MapGet("/api/dashboard/calendar", async (Func<IDbConnection> factory, int pastCount, int futureCount) =>
{
    using var conn = factory();

    var past = await conn.QueryAsync<dynamic>(
        $"""
        SELECT {TopP("@n")} f.FixtureId AS fixtureId, f.KickoffUtc AS kickoffUtc, f.CompetitionType AS competitionType,
               ht.Name AS homeTeam, ht.TeamId AS homeTeamId,
               at.Name AS awayTeam, at.TeamId AS awayTeamId,
               f.HomeGoals AS homeGoals, f.AwayGoals AS awayGoals,
               p.ProbHome AS probHome, p.ProbDraw AS probDraw, p.ProbAway AS probAway,
               p.ActualOutcome AS actualOutcome, p.WasCorrect AS wasCorrect
        FROM Fixtures f
        JOIN Teams ht ON f.HomeTeamId = ht.TeamId
        JOIN Teams at ON f.AwayTeamId = at.TeamId
        LEFT JOIN Predictions p ON p.FixtureId = f.FixtureId AND p.Market = '1X2'
        WHERE (f.HomeTeamId = @rm OR f.AwayTeamId = @rm) AND f.StatusShort = 'FT'
        ORDER BY f.KickoffUtc DESC
        {LimitP("@n")}
        """, new { rm = RealMadridId, n = pastCount == 0 ? 8 : pastCount });

    var future = await conn.QueryAsync<dynamic>(
        $"""
        SELECT {TopP("@n")} f.FixtureId AS fixtureId, f.KickoffUtc AS kickoffUtc, f.CompetitionType AS competitionType,
               ht.Name AS homeTeam, ht.TeamId AS homeTeamId,
               at.Name AS awayTeam, at.TeamId AS awayTeamId,
               p.ProbHome AS probHome, p.ProbDraw AS probDraw, p.ProbAway AS probAway
        FROM Fixtures f
        JOIN Teams ht ON f.HomeTeamId = ht.TeamId
        JOIN Teams at ON f.AwayTeamId = at.TeamId
        LEFT JOIN Predictions p ON p.FixtureId = f.FixtureId AND p.Market = '1X2' AND p.ActualOutcome IS NULL
        WHERE (f.HomeTeamId = @rm OR f.AwayTeamId = @rm) AND f.StatusShort = 'NS'
        ORDER BY f.KickoffUtc ASC
        {LimitP("@n")}
        """, new { rm = RealMadridId, n = futureCount == 0 ? 4 : futureCount });

    return Results.Ok(new { past = past.Reverse(), future });
});

app.MapGet("/api/dashboard/model-accuracy", async (Func<IDbConnection> factory) =>
{
    using var conn = factory();
    var stats = await conn.QuerySingleAsync<dynamic>(
        """
        SELECT COUNT(*) AS total, SUM(CAST(WasCorrect AS INT)) AS correct
        FROM Predictions WHERE Market = '1X2' AND ActualOutcome IS NOT NULL
        """);
    var recent = await conn.QuerySingleAsync<dynamic>(
        $"""
        SELECT COUNT(*) AS total, SUM(CAST(WasCorrect AS INT)) AS correct
        FROM Predictions p JOIN Fixtures f ON p.FixtureId = f.FixtureId
        WHERE p.Market = '1X2' AND p.ActualOutcome IS NOT NULL
        AND f.FixtureId IN (SELECT {Top(12)} FixtureId FROM Fixtures
            WHERE (HomeTeamId = @rm OR AwayTeamId = @rm) AND StatusShort = 'FT' ORDER BY KickoffUtc DESC {Limit(12)})
        """, new { rm = RealMadridId });
    // Baseline honesto: como Predictions solo tiene partidos del Real Madrid (nunca se
    // generan predicciones para el resto de la liga), el punto de comparación que
    // corresponde es "predecir siempre que gana el Real Madrid" -- no "gana el local"
    // (el Madrid juega la mitad de local y la mitad de visita). Coincide con el
    // comparador que ya existe en ml-service/train/compare_baseline_predictor.py
    // ("SOLO REAL MADRID"), esto solo lo trae al dashboard para no vivir únicamente en
    // un script que hay que correr a mano.
    var favoriteBaseline = await conn.QuerySingleAsync<dynamic>(
        """
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN (f.HomeTeamId = @rm AND p.ActualOutcome = 'H')
                          OR (f.AwayTeamId = @rm AND p.ActualOutcome = 'A') THEN 1 ELSE 0 END) AS correct
        FROM Predictions p JOIN Fixtures f ON p.FixtureId = f.FixtureId
        WHERE p.Market = '1X2' AND p.ActualOutcome IS NOT NULL
        """, new { rm = RealMadridId });
    // Calibración del modelo activo -- no solo si acierta, sino si sus probabilidades
    // son honestas (log loss / brier), ya se calcula en train_model.py y se guarda en
    // PredictionModels pero hasta ahora nunca se leía desde la API.
    var activeModel = await conn.QuerySingleOrDefaultAsync<dynamic>(
        $"""
        SELECT {Top(1)} Algorithm AS algorithm, Version AS version, ValAccuracy AS valAccuracy,
               ValLogLoss AS valLogLoss, ValBrier AS valBrier, TrainedAtUtc AS trainedAtUtc
        FROM PredictionModels WHERE Market = '1X2' AND IsActive = 1
        ORDER BY ModelId DESC
        {Limit(1)}
        """);
    return Results.Ok(new { overall = stats, last12 = recent, favoriteBaseline, activeModel });
});

app.MapGet("/api/predictions/{fixtureId:int}", async (Func<IDbConnection> factory, int fixtureId) =>
{
    using var conn = factory();
    var pred = await conn.QuerySingleOrDefaultAsync<dynamic>(
        "SELECT * FROM Predictions WHERE FixtureId = @id AND Market = '1X2'", new { id = fixtureId });
    return pred is null ? Results.NotFound() : Results.Ok(pred);
});

app.MapGet("/api/predictions/next/full", async (Func<IDbConnection> factory) =>
{
    using var conn = factory();
    var match = await conn.QuerySingleOrDefaultAsync<dynamic>(
        $"""
        SELECT {Top(1)} f.FixtureId AS fixtureId, f.KickoffUtc AS kickoffUtc, f.RoundLabel AS roundLabel,
               ht.Name AS homeTeam, ht.TeamId AS homeTeamId, at.Name AS awayTeam, at.TeamId AS awayTeamId
        FROM Fixtures f
        JOIN Teams ht ON f.HomeTeamId = ht.TeamId
        JOIN Teams at ON f.AwayTeamId = at.TeamId
        WHERE (f.HomeTeamId = @rm OR f.AwayTeamId = @rm) AND f.StatusShort = 'NS'
        ORDER BY f.KickoffUtc ASC
        {Limit(1)}
        """, new { rm = RealMadridId });
    if (match is null) return Results.NotFound();

    int fixtureId = (int)match.fixtureId;
    var x12 = await conn.QuerySingleOrDefaultAsync<dynamic>(
        "SELECT ProbHome AS probHome, ProbDraw AS probDraw, ProbAway AS probAway, BestScoreHome AS bestScoreHome, BestScoreAway AS bestScoreAway, BestScoreProb AS bestScoreProb FROM Predictions WHERE FixtureId=@id AND Market='1X2'",
        new { id = fixtureId });
    var btts = await conn.QuerySingleOrDefaultAsync<dynamic>(
        "SELECT ProbYes AS probYes FROM Predictions WHERE FixtureId=@id AND Market='BTTS'", new { id = fixtureId });
    var over25 = await conn.QuerySingleOrDefaultAsync<dynamic>(
        "SELECT ProbYes AS probYes FROM Predictions WHERE FixtureId=@id AND Market='OVER25'", new { id = fixtureId });

    int opponentId = (int)match.homeTeamId == RealMadridId ? (int)match.awayTeamId : (int)match.homeTeamId;
    var h2hSummary = await conn.QuerySingleAsync<dynamic>(
        """
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN (HomeTeamId=@rm AND HomeGoals>AwayGoals) OR (AwayTeamId=@rm AND AwayGoals>HomeGoals) THEN 1 ELSE 0 END) AS wins,
               SUM(CASE WHEN HomeGoals=AwayGoals THEN 1 ELSE 0 END) AS draws,
               SUM(CASE WHEN (HomeTeamId=@rm AND HomeGoals<AwayGoals) OR (AwayTeamId=@rm AND AwayGoals<HomeGoals) THEN 1 ELSE 0 END) AS losses
        FROM Fixtures
        WHERE ((HomeTeamId=@rm AND AwayTeamId=@opp) OR (HomeTeamId=@opp AND AwayTeamId=@rm)) AND StatusShort='FT'
        """, new { rm = RealMadridId, opp = opponentId });
    var h2hRecent = await conn.QueryAsync<dynamic>(
        $"""
        SELECT {Top(5)} f.KickoffUtc AS kickoffUtc, f.CompetitionType AS competitionType,
               f.HomeTeamId AS homeTeamId, f.AwayTeamId AS awayTeamId, f.HomeGoals AS homeGoals, f.AwayGoals AS awayGoals
        FROM Fixtures f
        WHERE ((f.HomeTeamId=@rm AND f.AwayTeamId=@opp) OR (f.HomeTeamId=@opp AND f.AwayTeamId=@rm)) AND f.StatusShort='FT'
        ORDER BY f.KickoffUtc DESC
        {Limit(5)}
        """, new { rm = RealMadridId, opp = opponentId });
    var recentForm = await RecentForm(conn);

    // Tendencia de disparos (a favor/en contra) de los últimos 5 partidos con datos --
    // no es xG real (API-Football no lo trae en el plan usado, y no está en el esquema),
    // así que se etiqueta honestamente como "disparos", no "expected goals". Sirve para
    // ver si el equipo genera/concede más peligro del que el resultado esconde.
    var shotsRows = (await conn.QueryAsync<dynamic>(
        $"""
        SELECT {Top(5)} f.KickoffUtc AS kickoffUtc,
               rm.ShotsOnGoal AS rmShotsOnGoal, rm.TotalShots AS rmTotalShots,
               opp.ShotsOnGoal AS oppShotsOnGoal, opp.TotalShots AS oppTotalShots
        FROM Fixtures f
        JOIN FixtureStatistics rm ON rm.FixtureId = f.FixtureId AND rm.TeamId = @rm
        JOIN FixtureStatistics opp ON opp.FixtureId = f.FixtureId AND opp.TeamId <> @rm
        WHERE (f.HomeTeamId = @rm OR f.AwayTeamId = @rm) AND f.StatusShort = 'FT'
        ORDER BY f.KickoffUtc DESC
        {Limit(5)}
        """, new { rm = RealMadridId })).ToList();

    object? shotsTrend = null;
    if (shotsRows.Count > 0)
    {
        // Convert.ToDouble en vez de un cast directo de dynamic -- algunas de estas
        // columnas son NULL-ables en la base y un (double)(x ?? 0) sobre dynamic es
        // frágil en tiempo de ejecución; Convert.ToDouble maneja null y numérico bien.
        double AvgOf(Func<dynamic, dynamic> selector) =>
            Math.Round(shotsRows.Average(r => Convert.ToDouble(selector(r) ?? 0)), 1);

        shotsTrend = new
        {
            matches = shotsRows.Count,
            avgShotsOnGoalFor = AvgOf(r => r.rmShotsOnGoal),
            avgShotsOnGoalAgainst = AvgOf(r => r.oppShotsOnGoal),
            avgTotalShotsFor = AvgOf(r => r.rmTotalShots),
            avgTotalShotsAgainst = AvgOf(r => r.oppTotalShots),
        };
    }

    return Results.Ok(new { match, x12, btts, over25, recentForm, shotsTrend, h2h = new { summary = h2hSummary, recent = h2hRecent } });
});

app.MapGet("/api/players", async (Func<IDbConnection> factory, string? position) =>
{
    using var conn = factory();
    var players = await conn.QueryAsync<dynamic>(
        """
        SELECT p.PlayerId AS playerId, p.Name AS name, p.Position AS position, p.Age AS age,
               p.Nationality AS nationality, p.PhotoUrl AS photoUrl, p.ShirtNumber AS shirtNumber,
               COALESCE(a.Overall, 65) AS overall, COALESCE(a.Potential, 70) AS potential,
               COALESCE(a.Pace, 65) AS pace, COALESCE(a.Shooting, 60) AS shooting,
               COALESCE(a.Passing, 65) AS passing, COALESCE(a.Dribbling, 65) AS dribbling,
               COALESCE(a.Defending, 60) AS defending, COALESCE(a.Physical, 65) AS physical,
               CASE WHEN a.Overall IS NULL THEN 1 ELSE 0 END AS isEstimated
        FROM Players p
        LEFT JOIN PlayerAttributes a ON p.PlayerId = a.PlayerId
        WHERE p.IsCurrentSquad = 1 AND (@position IS NULL OR p.Position = @position)
        ORDER BY COALESCE(a.Overall, 65) DESC
        """, new { position });
    return Results.Ok(players);
});

app.MapGet("/api/players/{playerId:int}", async (Func<IDbConnection> factory, int playerId) =>
{
    using var conn = factory();
    var player = await conn.QuerySingleOrDefaultAsync<dynamic>(
        """
        SELECT p.PlayerId AS playerId, p.Name AS name, p.Position AS position, p.Age AS age,
               p.Nationality AS nationality, p.PhotoUrl AS photoUrl, p.ShirtNumber AS shirtNumber,
               a.Overall AS overall, a.Potential AS potential, a.Pace AS pace, a.Shooting AS shooting,
               a.Passing AS passing, a.Dribbling AS dribbling, a.Defending AS defending, a.Physical AS physical,
               s.Minutes AS minutes, s.Goals AS goals, s.Assists AS assists, s.RatingAvg AS ratingAvg,
               s.PassesAccuracyPct AS passAccuracy
        FROM Players p
        JOIN PlayerAttributes a ON p.PlayerId = a.PlayerId
        JOIN PlayerSeasonStats s ON p.PlayerId = s.PlayerId AND s.Season = a.Season
        WHERE p.PlayerId = @playerId
        """, new { playerId });
    return player is null ? Results.NotFound() : Results.Ok(player);
});

// Bajas y dudas (lesión/sanción) -- API-Football no manda un flag limpio de
// "todavía afuera hoy", así que se aproxima el estado actual quedándose con el
// registro más reciente por jugador entre 14 días atrás y 21 días adelante de hoy
// (cubre lesiones que se anunciaron hace poco y sanciones ya conocidas para próximos
// partidos). El filtro de fecha se hace en C#, no en SQL, porque KickoffUtc se guarda
// como TEXT en SQLite -- comparar rangos de fecha como texto entre motores distintos
// es frágil; en memoria son unos pocos registros, no vale la pena el riesgo.
app.MapGet("/api/players/availability", async (Func<IDbConnection> factory) =>
{
    using var conn = factory();
    List<dynamic> rows;
    try
    {
        rows = (await conn.QueryAsync<dynamic>(
            """
            SELECT pa.PlayerId AS playerId, p.Name AS name, pa.Type AS type, pa.Reason AS reason,
                   f.FixtureId AS fixtureId, f.KickoffUtc AS kickoffUtc
            FROM PlayerAvailability pa
            JOIN Players p ON pa.PlayerId = p.PlayerId
            JOIN Fixtures f ON pa.FixtureId = f.FixtureId
            WHERE p.TeamId = @rm
            """, new { rm = RealMadridId })).ToList();
    }
    catch
    {
        // La tabla se crea sola la primera vez que corre "Actualizar datos" (o al
        // aplicar ml-service/sql/005_availability.sql en dev) -- si todavía no
        // existe, no hay bajas que mostrar, no es un error real.
        return Results.Ok(Array.Empty<object>());
    }

    var now = DateTime.UtcNow;
    var current = rows
        .Select(r => new { r, kickoff = Convert.ToDateTime(r.kickoffUtc) })
        .Where(x => (now - x.kickoff).TotalDays >= -21 && (now - x.kickoff).TotalDays <= 14)
        .OrderByDescending(x => x.kickoff)
        .GroupBy(x => (int)x.r.playerId)
        .Select(g => g.First().r)
        .ToList();

    return Results.Ok(current);
});

app.MapGet("/api/lineups/next", async (Func<IDbConnection> factory) =>
{
    using var conn = factory();
    var next = await conn.QuerySingleOrDefaultAsync<dynamic>(
        $"""
        SELECT {Top(1)} FixtureId AS fixtureId FROM Fixtures
        WHERE (HomeTeamId = @rm OR AwayTeamId = @rm) AND StatusShort = 'NS'
        ORDER BY KickoffUtc ASC
        {Limit(1)}
        """, new { rm = RealMadridId });
    if (next is null) return Results.NotFound();

    int fixtureId = (int)next.fixtureId;
    var lineup = await conn.QuerySingleOrDefaultAsync<dynamic>(
        $"SELECT {Top(1)} UserLineupId AS userLineupId, Formation AS formation, UpdatedAtUtc AS updatedAtUtc FROM UserLineups WHERE FixtureId = @id ORDER BY UserLineupId DESC {Limit(1)}",
        new { id = fixtureId });
    if (lineup is null) return Results.Ok(new { fixtureId, lineup = (object?)null, slots = Array.Empty<object>() });

    var slots = await conn.QueryAsync<dynamic>(
        """
        SELECT ulp.SlotPosition AS slotPosition, ulp.PlayerId AS playerId, p.Name AS playerName, p.Position AS position
        FROM UserLineupPlayers ulp JOIN Players p ON ulp.PlayerId = p.PlayerId
        WHERE ulp.UserLineupId = @id
        """, new { id = (int)lineup.userLineupId });

    return Results.Ok(new { fixtureId, lineup, slots });
});

app.MapPost("/api/lineups", async (Func<IDbConnection> factory, SaveLineupRequest req) =>
{
    using var conn = factory();

    var fixture = await conn.QuerySingleOrDefaultAsync<dynamic>(
        "SELECT StatusShort AS statusShort FROM Fixtures WHERE FixtureId = @id", new { id = req.FixtureId });
    if (fixture is null) return Results.NotFound(new { error = "Partido no encontrado" });
    if ((string)fixture.statusShort != "NS")
        return Results.BadRequest(new { error = "Solo puedes guardar la alineación del próximo partido sin jugarse" });

    var nextFixture = await conn.QuerySingleAsync<int>(
        $"""
        SELECT {Top(1)} FixtureId FROM Fixtures
        WHERE (HomeTeamId = @rm OR AwayTeamId = @rm) AND StatusShort = 'NS'
        ORDER BY KickoffUtc ASC
        {Limit(1)}
        """, new { rm = RealMadridId });
    if (nextFixture != req.FixtureId)
        return Results.BadRequest(new { error = "Solo se puede editar la alineación del próximo partido, no partidos futuros más lejanos" });

    if (conn.State != ConnectionState.Open) conn.Open();
    using var tx = conn.BeginTransaction();
    var existing = await conn.QuerySingleOrDefaultAsync<int?>(
        "SELECT UserLineupId FROM UserLineups WHERE FixtureId = @id", new { id = req.FixtureId }, tx);

    int lineupId;
    if (existing is int id)
    {
        lineupId = id;
        await conn.ExecuteAsync(
            "UPDATE UserLineups SET Formation=@f, UpdatedAtUtc=@now WHERE UserLineupId=@id",
            new { f = req.Formation, id = lineupId, now = DateTime.UtcNow }, tx);
        await conn.ExecuteAsync("DELETE FROM UserLineupPlayers WHERE UserLineupId=@id", new { id = lineupId }, tx);
    }
    else if (isSqlite)
    {
        lineupId = await conn.QuerySingleAsync<int>(
            "INSERT INTO UserLineups (FixtureId, Formation) VALUES (@f, @form); SELECT last_insert_rowid();",
            new { f = req.FixtureId, form = req.Formation }, tx);
    }
    else
    {
        lineupId = await conn.QuerySingleAsync<int>(
            "INSERT INTO UserLineups (FixtureId, Formation) OUTPUT INSERTED.UserLineupId VALUES (@f, @form)",
            new { f = req.FixtureId, form = req.Formation }, tx);
    }

    foreach (var slot in req.Slots)
    {
        await conn.ExecuteAsync(
            "INSERT INTO UserLineupPlayers (UserLineupId, PlayerId, SlotPosition) VALUES (@lid, @pid, @slot)",
            new { lid = lineupId, pid = slot.PlayerId, slot = slot.SlotPosition }, tx);
    }

    tx.Commit();
    return Results.Ok(new { lineupId });
});

app.MapGet("/api/predictions/next/scorers", async (Func<IDbConnection> factory) =>
{
    using var conn = factory();
    var next = await conn.QuerySingleOrDefaultAsync<dynamic>(
        $"""
        SELECT {Top(1)} f.FixtureId AS fixtureId, f.HomeTeamId AS homeTeamId,
               p.LambdaHome AS lambdaHome, p.LambdaAway AS lambdaAway
        FROM Fixtures f JOIN Predictions p ON p.FixtureId = f.FixtureId AND p.Market='1X2'
        WHERE (f.HomeTeamId=@rm OR f.AwayTeamId=@rm) AND f.StatusShort='NS'
        ORDER BY f.KickoffUtc ASC
        {Limit(1)}
        """, new { rm = RealMadridId });
    if (next is null) return Results.Ok(new { scorers = Array.Empty<object>() });

    double madridLambda = (int)next.homeTeamId == RealMadridId ? (double)next.lambdaHome : (double)next.lambdaAway;

    var goalShares = await conn.QueryAsync<dynamic>(
        """
        SELECT p.PlayerId AS playerId, p.Name AS name, s.Goals AS goals
        FROM PlayerSeasonStats s JOIN Players p ON s.PlayerId = p.PlayerId
        WHERE s.Goals > 0
        """);
    var list = goalShares.ToList();
    double totalGoals = list.Sum(g => (double)(int)g.goals);
    if (totalGoals <= 0) return Results.Ok(new { scorers = Array.Empty<object>() });

    var scorers = list
        .Select(g => new
        {
            playerId = g.playerId,
            name = g.name,
            goalsThisSeason = g.goals,
            probability = Math.Round((1 - Math.Exp(-madridLambda * ((int)g.goals / totalGoals))) * 100, 1),
        })
        .OrderByDescending(s => s.probability)
        .Take(5);

    return Results.Ok(new { fixtureId = next.fixtureId, madridExpectedGoals = Math.Round(madridLambda, 2), scorers });
});

app.MapGet("/api/predictions/next/value", async (Func<IDbConnection> factory) =>
{
    using var conn = factory();
    var fixtureId = await conn.QuerySingleOrDefaultAsync<int?>(
        $"""
        SELECT {Top(1)} f.FixtureId FROM Fixtures f
        WHERE (f.HomeTeamId=@rm OR f.AwayTeamId=@rm) AND f.StatusShort='NS'
        AND EXISTS (SELECT 1 FROM OddsSnapshots o WHERE o.FixtureId=f.FixtureId)
        ORDER BY f.KickoffUtc ASC
        {Limit(1)}
        """, new { rm = RealMadridId });
    if (fixtureId is null) return Results.Ok(new { hasValue = false, markets = Array.Empty<object>() });

    var isHome = await conn.QuerySingleAsync<bool>(
        "SELECT CAST(CASE WHEN HomeTeamId=@rm THEN 1 ELSE 0 END AS BIT) FROM Fixtures WHERE FixtureId=@id",
        new { rm = RealMadridId, id = fixtureId });

    var model = await conn.QuerySingleOrDefaultAsync<dynamic>(
        "SELECT ProbHome AS probHome, ProbDraw AS probDraw, ProbAway AS probAway FROM Predictions WHERE FixtureId=@id AND Market='1X2'",
        new { id = fixtureId });
    var books = (await conn.QueryAsync<dynamic>(
        "SELECT ImpliedHome AS impliedHome, ImpliedDraw AS impliedDraw, ImpliedAway AS impliedAway FROM OddsSnapshots WHERE FixtureId=@id",
        new { id = fixtureId })).ToList();
    if (model is null || books.Count == 0) return Results.Ok(new { hasValue = false, markets = Array.Empty<object>() });

    double avgHome = books.Average(b => (double)b.impliedHome);
    double avgDraw = books.Average(b => (double)b.impliedDraw);
    double avgAway = books.Average(b => (double)b.impliedAway);

    var candidates = new[]
    {
        new { market = "Gana el Real Madrid", modelProb = isHome ? (double)model.probHome : (double)model.probAway, marketProb = isHome ? avgHome : avgAway },
        new { market = "Empate", modelProb = (double)model.probDraw, marketProb = avgDraw },
        new { market = "Gana el rival", modelProb = isHome ? (double)model.probAway : (double)model.probHome, marketProb = isHome ? avgAway : avgHome },
    };
    var best = candidates.OrderByDescending(c => c.modelProb - c.marketProb).First();
    double edge = best.modelProb - best.marketProb;
    bool hasValue = edge > 0.03;

    // Se guarda el "value bet" que de verdad se le mostró al usuario -- así después,
    // una vez jugado el partido, /api/predictions/value-track-record puede medir si
    // esa divergencia modelo-vs-mercado acertó o no. Se sobreescribe por partido (solo
    // interesa el último cálculo antes del kickoff, con los momios más recientes).
    if (hasValue)
    {
        // Resultado (H/D/A, mismo vocabulario que Predictions.ActualOutcome) que hace
        // ganador a ESTE mercado para ESTE partido puntual -- depende de si el Madrid
        // jugaba de local, por eso se resuelve aquí y no se asume fijo por mercado.
        string side = best.market switch
        {
            "Empate" => "D",
            "Gana el Real Madrid" => isHome ? "H" : "A",
            "Gana el rival" => isHome ? "A" : "H",
            _ => throw new InvalidOperationException($"Mercado desconocido: {best.market}"),
        };
        var upsertSql = isSqlite
            ? """
              INSERT INTO ValueBetLog (FixtureId, Market, RecommendedSide, ModelProb, MarketProb, EdgePct, LoggedAtUtc)
              VALUES (@fid, @market, @side, @modelProb, @marketProb, @edgePct, @now)
              ON CONFLICT(FixtureId) DO UPDATE SET
                Market=excluded.Market, RecommendedSide=excluded.RecommendedSide, ModelProb=excluded.ModelProb,
                MarketProb=excluded.MarketProb, EdgePct=excluded.EdgePct, LoggedAtUtc=excluded.LoggedAtUtc;
              """
            : """
              MERGE dbo.ValueBetLog AS tgt
              USING (SELECT @fid AS FixtureId) AS src ON tgt.FixtureId = src.FixtureId
              WHEN MATCHED THEN UPDATE SET Market=@market, RecommendedSide=@side, ModelProb=@modelProb,
                MarketProb=@marketProb, EdgePct=@edgePct, LoggedAtUtc=@now
              WHEN NOT MATCHED THEN INSERT (FixtureId, Market, RecommendedSide, ModelProb, MarketProb, EdgePct, LoggedAtUtc)
                VALUES (@fid, @market, @side, @modelProb, @marketProb, @edgePct, @now);
              """;
        await conn.ExecuteAsync(upsertSql, new
        {
            fid = fixtureId,
            market = best.market,
            side,
            modelProb = best.modelProb,
            marketProb = best.marketProb,
            edgePct = Math.Round(edge * 100, 1),
            now = DateTime.UtcNow,
        });
    }

    return Results.Ok(new
    {
        hasValue,
        edgePct = Math.Round(edge * 100, 1),
        market = best.market,
        modelProbPct = Math.Round(best.modelProb * 100, 1),
        marketProbPct = Math.Round(best.marketProb * 100, 1),
    });
});

// Historial de aciertos de los value bets ya registrados -- responde la pregunta que
// el dato aislado de arriba no puede: "¿esta sección de verdad ayuda, o es ruido?".
app.MapGet("/api/predictions/value-track-record", async (Func<IDbConnection> factory) =>
{
    using var conn = factory();
    var stats = await conn.QuerySingleAsync<dynamic>(
        """
        SELECT COUNT(*) AS total, SUM(CASE WHEN v.RecommendedSide = p.ActualOutcome THEN 1 ELSE 0 END) AS correct
        FROM ValueBetLog v
        JOIN Predictions p ON p.FixtureId = v.FixtureId AND p.Market = '1X2'
        WHERE p.ActualOutcome IS NOT NULL
        """);
    var recent = await conn.QueryAsync<dynamic>(
        $"""
        SELECT {Top(10)} v.FixtureId AS fixtureId, v.Market AS market, v.EdgePct AS edgePct,
               p.ActualOutcome AS actualOutcome,
               CASE WHEN v.RecommendedSide = p.ActualOutcome THEN 1 ELSE 0 END AS wasCorrect,
               f.KickoffUtc AS kickoffUtc,
               CASE WHEN f.HomeTeamId=@rm THEN at.Name ELSE ht.Name END AS opponent
        FROM ValueBetLog v
        JOIN Predictions p ON p.FixtureId = v.FixtureId AND p.Market = '1X2'
        JOIN Fixtures f ON f.FixtureId = v.FixtureId
        JOIN Teams ht ON f.HomeTeamId = ht.TeamId
        JOIN Teams at ON f.AwayTeamId = at.TeamId
        WHERE p.ActualOutcome IS NOT NULL
        ORDER BY f.KickoffUtc DESC
        {Limit(10)}
        """, new { rm = RealMadridId });
    return Results.Ok(new { overall = stats, recent });
});

app.MapGet("/api/odds/next", async (Func<IDbConnection> factory) =>
{
    using var conn = factory();
    var match = await conn.QuerySingleOrDefaultAsync<dynamic>(
        $"""
        SELECT {Top(1)} f.FixtureId AS fixtureId, f.KickoffUtc AS kickoffUtc,
               ht.Name AS homeTeam, ht.TeamId AS homeTeamId, at.Name AS awayTeam, at.TeamId AS awayTeamId
        FROM Fixtures f JOIN Teams ht ON f.HomeTeamId=ht.TeamId JOIN Teams at ON f.AwayTeamId=at.TeamId
        WHERE (f.HomeTeamId=@rm OR f.AwayTeamId=@rm) AND f.StatusShort='NS'
        AND EXISTS (SELECT 1 FROM OddsSnapshots o WHERE o.FixtureId = f.FixtureId)
        ORDER BY f.KickoffUtc ASC
        {Limit(1)}
        """, new { rm = RealMadridId });
    if (match is null) return Results.Ok(new { match = (object?)null, model = (object?)null, bookmakers = Array.Empty<object>() });

    int fixtureId = (int)match.fixtureId;
    var model = await conn.QuerySingleOrDefaultAsync<dynamic>(
        "SELECT ProbHome AS probHome, ProbDraw AS probDraw, ProbAway AS probAway FROM Predictions WHERE FixtureId=@id AND Market='1X2'",
        new { id = fixtureId });
    var books = await conn.QueryAsync<dynamic>(
        """
        SELECT Bookmaker AS bookmaker, OddHome AS oddHome, OddDraw AS oddDraw, OddAway AS oddAway,
               ImpliedHome AS impliedHome, ImpliedDraw AS impliedDraw, ImpliedAway AS impliedAway
        FROM OddsSnapshots WHERE FixtureId=@id ORDER BY Bookmaker
        """, new { id = fixtureId });

    return Results.Ok(new { match, model, bookmakers = books });
});

app.MapGet("/api/coach/current", async (Func<IDbConnection> factory) =>
{
    using var conn = factory();
    var coach = await conn.QuerySingleOrDefaultAsync<dynamic>(
        $"""
        SELECT {Top(1)} co.CoachId AS coachId, co.Name AS name, co.Nationality AS nationality, co.PhotoUrl AS photoUrl,
               cc.StartDate AS startDate, cc.EndDate AS endDate
        FROM CoachCareer cc JOIN Coaches co ON cc.CoachId = co.CoachId
        WHERE cc.TeamId = @rm ORDER BY cc.StartDate DESC
        {Limit(1)}
        """, new { rm = RealMadridId });
    if (coach is null) return Results.NotFound();

    DateTime start = Convert.ToDateTime(coach.startDate);
    DateTime? end = coach.endDate is null ? null : Convert.ToDateTime(coach.endDate);
    var stats = await conn.QuerySingleAsync<dynamic>(
        """
        SELECT COUNT(*) AS played,
               SUM(CASE WHEN (HomeTeamId=@rm AND HomeGoals>AwayGoals) OR (AwayTeamId=@rm AND AwayGoals>HomeGoals) THEN 1 ELSE 0 END) AS wins,
               SUM(CASE WHEN HomeGoals=AwayGoals THEN 1 ELSE 0 END) AS draws
        FROM Fixtures
        WHERE (HomeTeamId=@rm OR AwayTeamId=@rm) AND StatusShort='FT' AND KickoffUtc >= @start
        AND (@end IS NULL OR KickoffUtc <= @end)
        """, new { rm = RealMadridId, start, end });

    var preferredFormation = await conn.QuerySingleOrDefaultAsync<dynamic>(
        $"""
        SELECT {Top(1)} ml.Formation AS formation, COUNT(*) AS matches
        FROM MatchLineups ml
        WHERE ml.TeamId = @rm AND ml.CoachName = @name AND ml.Formation IS NOT NULL
        GROUP BY ml.Formation
        ORDER BY COUNT(*) DESC
        {Limit(1)}
        """, new { rm = RealMadridId, name = (string)coach.name });

    var career = await conn.QueryAsync<dynamic>(
        """
        SELECT cc.TeamName AS teamName, cc.StartDate AS startDate, cc.EndDate AS endDate
        FROM CoachCareer cc WHERE cc.CoachId = @id ORDER BY cc.StartDate DESC
        """, new { id = (int)coach.coachId });

    return Results.Ok(new { coach, stats, preferredFormation, career });
});

app.MapGet("/api/ratings/comparison", async (Func<IDbConnection> factory) =>
{
    using var conn = factory();
    var rows = await conn.QueryAsync<dynamic>(
        """
        SELECT p.PlayerId AS playerId, p.Name AS name, p.PhotoUrl AS photoUrl,
               AVG(mr.AiRating) AS aiAvg, COUNT(DISTINCT mr.FixtureId) AS aiCount,
               (SELECT AVG(ur.Rating) FROM UserPlayerRatings ur WHERE ur.PlayerId = p.PlayerId) AS userAvg,
               (SELECT COUNT(*) FROM UserPlayerRatings ur WHERE ur.PlayerId = p.PlayerId) AS userCount
        FROM MatchPlayerRatings mr JOIN Players p ON mr.PlayerId = p.PlayerId
        GROUP BY p.PlayerId, p.Name, p.PhotoUrl
        HAVING COUNT(DISTINCT mr.FixtureId) >= 1
        ORDER BY AVG(mr.AiRating) DESC
        """);
    return Results.Ok(rows);
});

app.MapGet("/api/ratings/last-match", async (Func<IDbConnection> factory) =>
{
    using var conn = factory();
    var match = await conn.QuerySingleOrDefaultAsync<dynamic>(
        $"""
        SELECT {Top(1)} f.FixtureId AS fixtureId, f.KickoffUtc AS kickoffUtc, f.Season AS season,
               ht.Name AS homeTeam, ht.TeamId AS homeTeamId, at.Name AS awayTeam, at.TeamId AS awayTeamId,
               f.HomeGoals AS homeGoals, f.AwayGoals AS awayGoals
        FROM Fixtures f JOIN Teams ht ON f.HomeTeamId=ht.TeamId JOIN Teams at ON f.AwayTeamId=at.TeamId
        WHERE (f.HomeTeamId=@rm OR f.AwayTeamId=@rm) AND f.StatusShort='FT'
        AND FixtureId IN (SELECT DISTINCT FixtureId FROM MatchLineups)
        ORDER BY f.KickoffUtc DESC
        {Limit(1)}
        """, new { rm = RealMadridId });
    if (match is null) return Results.Ok(new { match = (object?)null, players = Array.Empty<object>() });

    int fixtureId = (int)match.fixtureId;
    var players = await conn.QueryAsync<dynamic>(
        """
        SELECT mlp.PlayerId AS playerId, mlp.PlayerName AS playerName, mlp.PosCode AS posCode,
               mlp.IsStarter AS isStarter, r.Rating AS rating, r.Review AS review
        FROM MatchLineupPlayers mlp
        LEFT JOIN UserPlayerRatings r ON r.FixtureId = mlp.FixtureId AND r.PlayerId = mlp.PlayerId
        WHERE mlp.FixtureId = @id AND mlp.TeamId = @rm
        ORDER BY mlp.IsStarter DESC, mlp.ShirtNumber
        """, new { id = fixtureId, rm = RealMadridId });

    return Results.Ok(new { match, players });
});

app.MapPost("/api/ratings", async (Func<IDbConnection> factory, RatingRequest req) =>
{
    if (req.Rating < 0 || req.Rating > 10) return Results.BadRequest(new { error = "La calificación debe estar entre 0 y 10" });
    using var conn = factory();
    var upsertSql = isSqlite
        ? """
          INSERT INTO UserPlayerRatings (FixtureId, PlayerId, Rating, Review, RatedAtUtc) VALUES (@fid, @pid, @rating, @review, @now)
          ON CONFLICT(FixtureId, PlayerId) DO UPDATE SET Rating=excluded.Rating, Review=excluded.Review, RatedAtUtc=excluded.RatedAtUtc;
          """
        : """
          MERGE dbo.UserPlayerRatings AS tgt
          USING (SELECT @fid AS FixtureId, @pid AS PlayerId) AS src
          ON tgt.FixtureId = src.FixtureId AND tgt.PlayerId = src.PlayerId
          WHEN MATCHED THEN UPDATE SET Rating=@rating, Review=@review, RatedAtUtc=@now
          WHEN NOT MATCHED THEN INSERT (FixtureId, PlayerId, Rating, Review, RatedAtUtc) VALUES (@fid, @pid, @rating, @review, @now);
          """;
    await conn.ExecuteAsync(upsertSql, new { fid = req.FixtureId, pid = req.PlayerId, rating = req.Rating, review = req.Review, now = DateTime.UtcNow });
    return Results.Ok(new { ok = true });
});

app.MapGet("/api/ratings/ranking", async (Func<IDbConnection> factory) =>
{
    using var conn = factory();
    var ranking = await conn.QueryAsync<dynamic>(
        """
        SELECT p.PlayerId AS playerId, p.Name AS name, p.Position AS position, p.PhotoUrl AS photoUrl,
               AVG(r.Rating) AS avgRating, COUNT(*) AS ratingsCount
        FROM UserPlayerRatings r JOIN Players p ON r.PlayerId = p.PlayerId
        GROUP BY p.PlayerId, p.Name, p.Position, p.PhotoUrl
        ORDER BY AVG(r.Rating) DESC
        """);
    return Results.Ok(ranking);
});

app.MapGet("/api/podcast/analysis/last-match", async (Func<IDbConnection> factory) =>
{
    using var conn = factory();
    var match = await conn.QuerySingleOrDefaultAsync<dynamic>(
        $"""
        SELECT {Top(1)} f.FixtureId AS fixtureId, f.KickoffUtc AS kickoffUtc, f.CompetitionType AS competitionType,
               f.HomeGoals AS homeGoals, f.AwayGoals AS awayGoals,
               ht.Name AS homeTeam, ht.TeamId AS homeTeamId, at.Name AS awayTeam, at.TeamId AS awayTeamId
        FROM Fixtures f JOIN Teams ht ON f.HomeTeamId=ht.TeamId JOIN Teams at ON f.AwayTeamId=at.TeamId
        WHERE (f.HomeTeamId=@rm OR f.AwayTeamId=@rm) AND f.StatusShort='FT'
        ORDER BY f.KickoffUtc DESC
        {Limit(1)}
        """, new { rm = RealMadridId });
    if (match is null) return Results.Ok(new { text = "Sin partidos jugados todavía." });

    int fixtureId = (int)match.fixtureId;
    bool isHome = (int)match.homeTeamId == RealMadridId;
    int rmGoals = isHome ? (int)match.homeGoals : (int)match.awayGoals;
    int oppGoals = isHome ? (int)match.awayGoals : (int)match.homeGoals;
    string opponent = isHome ? (string)match.awayTeam : (string)match.homeTeam;
    string result = rmGoals > oppGoals ? "victoria" : rmGoals < oppGoals ? "derrota" : "empate";

    var goals = (await conn.QueryAsync<dynamic>(
        "SELECT PlayerName AS playerName, AssistPlayerName AS assistPlayerName, Minute AS minute, TeamId AS teamId FROM MatchEvents2 WHERE FixtureId=@id AND EventType='Goal' ORDER BY Minute",
        new { id = fixtureId })).ToList();
    var rmGoalScorers = goals.Where(g => (int)g.teamId == RealMadridId).ToList();

    var ratings = (await conn.QueryAsync<dynamic>(
        """
        SELECT p.Name AS name, mr.AiRating AS aiRating,
               (SELECT ur.Rating FROM UserPlayerRatings ur WHERE ur.FixtureId=mr.FixtureId AND ur.PlayerId=mr.PlayerId) AS userRating
        FROM MatchPlayerRatings mr JOIN Players p ON mr.PlayerId = p.PlayerId
        WHERE mr.FixtureId=@id ORDER BY mr.AiRating DESC
        """, new { id = fixtureId })).ToList();

    var rnd = new Random();
    string Pick(params string[] opts) => opts[rnd.Next(opts.Length)];
    string compName = match.competitionType == "UCL" ? "la Champions League" : "LaLiga";

    var sb = new System.Text.StringBuilder();
    sb.Append(Pick(
        $"El Real Madrid {(isHome ? "recibió" : "visitó")} a {opponent} y se llevó una {result} por {rmGoals}-{oppGoals} en {compName}. ",
        $"{result[0].ToString().ToUpper()}{result.Substring(1)} del Real Madrid ante {opponent}: {rmGoals}-{oppGoals}, en {compName}. ",
        $"Partido {(isHome ? "en casa" : "de visita")} ante {opponent} — el marcador final fue {rmGoals}-{oppGoals} ({compName}). "
    ));

    if (rmGoalScorers.Count > 0)
    {
        var parts = rmGoalScorers.Select(g => g.assistPlayerName != null
            ? $"{g.playerName} al {g.minute}' (asistencia de {g.assistPlayerName})"
            : $"{g.playerName} al {g.minute}'");
        sb.Append(Pick(
            "Los goles del equipo fueron obra de " + string.Join(", ", parts) + ". ",
            "Anotaron por el Madrid: " + string.Join(", ", parts) + ". ",
            "En el marcador quedaron registrados " + string.Join(", ", parts) + ". "
        ));
    }

    if (ratings.Count > 0)
    {
        var mvp = ratings[0];
        sb.Append(Pick(
            $"La mejor calificación de la casa (dato real de rendimiento del partido) fue para {mvp.name} con {mvp.aiRating}. ",
            $"{mvp.name} se llevó la mejor nota del partido según el dato real: {mvp.aiRating}. ",
            $"Si hay que quedarse con un nombre, es {mvp.name} — {mvp.aiRating} de calificación real. "
        ));
        var worst = ratings[^1];
        if (ratings.Count > 1)
            sb.Append(Pick(
                $"El más flojo, según ese mismo dato, fue {worst.name} ({worst.aiRating}). ",
                $"En el otro extremo quedó {worst.name}, con {worst.aiRating}. ",
                $"No todo fue positivo: {worst.name} tuvo la nota más baja ({worst.aiRating}). "
            ));

        var withUser = ratings.Where(r => r.userRating != null).ToList();
        if (withUser.Count > 0)
        {
            foreach (var r in withUser.Take(2))
            {
                double diff = (double)r.userRating - (double)r.aiRating;
                string cmp = diff > 0.5 ? "más alto que" : diff < -0.5 ? "más bajo que" : "en línea con";
                sb.Append($"Tú calificaste a {r.name} con {r.userRating}, {cmp} el dato ({r.aiRating}). ");
            }
        }
        else
        {
            sb.Append("Todavía no calificaste a nadie de este partido en /calificaciones — hazlo para que tu opinión entre a este análisis. ");
        }
    }

    return Results.Ok(new { fixtureId, text = sb.ToString().Trim() });
});

app.MapGet("/api/ratings/seasons", async (Func<IDbConnection> factory) =>
{
    using var conn = factory();
    var seasons = await conn.QueryAsync<dynamic>(
        """
        SELECT DISTINCT f.Season AS season
        FROM Fixtures f
        WHERE (f.HomeTeamId=@rm OR f.AwayTeamId=@rm)
        AND (
            (f.StatusShort='FT' AND f.FixtureId IN (SELECT DISTINCT FixtureId FROM MatchLineups))
            OR f.Season = (SELECT MAX(Season) FROM Fixtures WHERE HomeTeamId=@rm OR AwayTeamId=@rm)
        )
        ORDER BY f.Season DESC
        """, new { rm = RealMadridId });
    return Results.Ok(seasons);
});

app.MapGet("/api/ratings/season/{season:int}", async (Func<IDbConnection> factory, int season) =>
{
    using var conn = factory();
    var matches = (await conn.QueryAsync<dynamic>(
        """
        SELECT f.FixtureId AS fixtureId, f.KickoffUtc AS kickoffUtc, f.CompetitionType AS competitionType,
               CASE WHEN f.HomeTeamId=@rm THEN at.Name ELSE ht.Name END AS opponent,
               f.HomeGoals AS homeGoals, f.AwayGoals AS awayGoals
        FROM Fixtures f JOIN Teams ht ON f.HomeTeamId=ht.TeamId JOIN Teams at ON f.AwayTeamId=at.TeamId
        WHERE (f.HomeTeamId=@rm OR f.AwayTeamId=@rm) AND f.StatusShort='FT' AND f.Season=@season
        AND f.FixtureId IN (SELECT DISTINCT FixtureId FROM MatchLineups)
        ORDER BY f.KickoffUtc ASC
        """, new { rm = RealMadridId, season })).ToList();

    var ratings = await conn.QueryAsync<dynamic>(
        """
        SELECT p.PlayerId AS playerId, p.Name AS name, mlp.FixtureId AS fixtureId,
               mr.AiRating AS aiRating, ur.Rating AS userRating
        FROM MatchLineupPlayers mlp
        JOIN Players p ON mlp.PlayerId = p.PlayerId
        JOIN Fixtures f ON mlp.FixtureId = f.FixtureId
        LEFT JOIN MatchPlayerRatings mr ON mr.FixtureId=mlp.FixtureId AND mr.PlayerId=mlp.PlayerId
        LEFT JOIN UserPlayerRatings ur ON ur.FixtureId=mlp.FixtureId AND ur.PlayerId=mlp.PlayerId
        WHERE mlp.TeamId=@rm AND mlp.IsStarter=1 AND f.Season=@season
        """, new { rm = RealMadridId, season });

    return Results.Ok(new { matches, ratings });
});

app.MapGet("/api/ratings/season-progress/{playerId:int}", async (Func<IDbConnection> factory, int playerId) =>
{
    using var conn = factory();
    var rows = await conn.QueryAsync<dynamic>(
        $"""
        SELECT {Top(10)} f.FixtureId AS fixtureId, f.KickoffUtc AS kickoffUtc,
               CASE WHEN f.HomeTeamId=@rm THEN at.Name ELSE ht.Name END AS opponent,
               mr.AiRating AS aiRating, ur.Rating AS userRating
        FROM Fixtures f
        JOIN Teams ht ON f.HomeTeamId=ht.TeamId
        JOIN Teams at ON f.AwayTeamId=at.TeamId
        LEFT JOIN MatchPlayerRatings mr ON mr.FixtureId=f.FixtureId AND mr.PlayerId=@pid
        LEFT JOIN UserPlayerRatings ur ON ur.FixtureId=f.FixtureId AND ur.PlayerId=@pid
        WHERE (f.HomeTeamId=@rm OR f.AwayTeamId=@rm) AND f.StatusShort='FT'
        AND (mr.AiRating IS NOT NULL OR ur.Rating IS NOT NULL)
        ORDER BY f.KickoffUtc DESC
        {Limit(10)}
        """, new { rm = RealMadridId, pid = playerId });
    return Results.Ok(rows.Reverse());
});

app.MapGet("/api/ratings/season-table", async (Func<IDbConnection> factory) =>
{
    using var conn = factory();
    var matches = (await conn.QueryAsync<dynamic>(
        """
        SELECT f.FixtureId AS fixtureId, f.KickoffUtc AS kickoffUtc,
               CASE WHEN f.HomeTeamId=@rm THEN at.Name ELSE ht.Name END AS opponent
        FROM Fixtures f JOIN Teams ht ON f.HomeTeamId=ht.TeamId JOIN Teams at ON f.AwayTeamId=at.TeamId
        WHERE (f.HomeTeamId=@rm OR f.AwayTeamId=@rm) AND f.StatusShort='FT'
        AND FixtureId IN (SELECT DISTINCT FixtureId FROM MatchLineups)
        ORDER BY f.KickoffUtc DESC
        """, new { rm = RealMadridId })).ToList();

    var ratings = await conn.QueryAsync<dynamic>(
        """
        SELECT p.PlayerId AS playerId, p.Name AS name, mlp.FixtureId AS fixtureId,
               mr.AiRating AS aiRating, ur.Rating AS userRating
        FROM MatchLineupPlayers mlp
        JOIN Players p ON mlp.PlayerId = p.PlayerId
        LEFT JOIN MatchPlayerRatings mr ON mr.FixtureId=mlp.FixtureId AND mr.PlayerId=mlp.PlayerId
        LEFT JOIN UserPlayerRatings ur ON ur.FixtureId=mlp.FixtureId AND ur.PlayerId=mlp.PlayerId
        WHERE mlp.TeamId=@rm AND mlp.IsStarter=1 AND p.IsCurrentSquad=1
        """, new { rm = RealMadridId });

    return Results.Ok(new { matches, ratings });
});

app.MapGet("/api/podcast/history", async (Func<IDbConnection> factory) =>
{
    using var conn = factory();
    try
    {
        // Última medición de vistas por episodio (si hay alguna) -- ver EpisodeMetrics.
        // El JOIN se cae si la tabla todavía no existe (instalación vieja); en ese caso
        // se responde igual, solo sin la columna de vistas, en vez de romper la pantalla.
        var rows = await conn.QueryAsync<dynamic>(
            """
            SELECT ph.PodcastId AS podcastId, ph.FixtureId AS fixtureId, ph.Title AS title, ph.EpisodeLabel AS episodeLabel,
                   ph.YoutubeLink AS youtubeLink, ph.GeneratedAtUtc AS generatedAtUtc,
                   latest.ViewsCount AS latestViews, latest.MeasuredAtUtc AS viewsMeasuredAtUtc
            FROM PodcastHistory ph
            LEFT JOIN (
                SELECT em.PodcastId, em.ViewsCount, em.MeasuredAtUtc
                FROM EpisodeMetrics em
                WHERE em.MeasuredAtUtc = (SELECT MAX(em2.MeasuredAtUtc) FROM EpisodeMetrics em2 WHERE em2.PodcastId = em.PodcastId)
            ) latest ON latest.PodcastId = ph.PodcastId
            ORDER BY ph.GeneratedAtUtc DESC
            """);
        return Results.Ok(rows);
    }
    catch
    {
        // Mismas columnas que el caso feliz (latestViews/viewsMeasuredAtUtc en null) --
        // así el frontend siempre ve la misma forma de respuesta, nunca un campo ausente.
        var rows = await conn.QueryAsync<dynamic>(
            """
            SELECT PodcastId AS podcastId, FixtureId AS fixtureId, Title AS title, EpisodeLabel AS episodeLabel,
                   YoutubeLink AS youtubeLink, GeneratedAtUtc AS generatedAtUtc,
                   NULL AS latestViews, NULL AS viewsMeasuredAtUtc
            FROM PodcastHistory ORDER BY GeneratedAtUtc DESC
            """);
        return Results.Ok(rows);
    }
});

app.MapPost("/api/podcast/history", async (Func<IDbConnection> factory, PodcastLogRequest req) =>
{
    if (string.IsNullOrWhiteSpace(req.YoutubeLink) || string.IsNullOrWhiteSpace(req.EpisodeLabel))
        return Results.BadRequest(new { error = "Falta el episodio o el link de YouTube -- solo se guarda cuando el video ya está publicado." });
    using var conn = factory();
    await conn.ExecuteAsync(
        "INSERT INTO PodcastHistory (FixtureId, Title, EpisodeLabel, YoutubeLink) VALUES (@fid, @title, @ep, @link)",
        new { fid = req.FixtureId, title = req.Title, ep = req.EpisodeLabel, link = req.YoutubeLink });
    return Results.Ok(new { ok = true });
});

// Vistas/engagement por episodio -- cargadas a mano (no hay integración con YouTube
// Analytics), para empezar a construir un dataset propio de "qué formato funciona"
// en vez de adivinar, mismo principio que el resto del proyecto.
app.MapPost("/api/podcast/{podcastId:int}/metrics", async (Func<IDbConnection> factory, int podcastId, EpisodeMetricRequest req) =>
{
    if (req.ViewsCount < 0) return Results.BadRequest(new { error = "Las vistas no pueden ser negativas." });
    using var conn = factory();
    if (isSqlite)
    {
        await conn.ExecuteAsync(
            """
            CREATE TABLE IF NOT EXISTS EpisodeMetrics (
                EpisodeMetricId INTEGER PRIMARY KEY,
                PodcastId INTEGER NOT NULL,
                ViewsCount INTEGER NOT NULL,
                MeasuredAtUtc TEXT
            )
            """);
    }
    await conn.ExecuteAsync(
        "INSERT INTO EpisodeMetrics (PodcastId, ViewsCount, MeasuredAtUtc) VALUES (@pid, @views, @now)",
        new { pid = podcastId, views = req.ViewsCount, now = DateTime.UtcNow });
    return Results.Ok(new { ok = true });
});

app.MapGet("/api/podcast/suggestions/{fixtureId:int}", async (Func<IDbConnection> factory, int fixtureId) =>
{
    using var conn = factory();
    var match = await conn.QuerySingleOrDefaultAsync<dynamic>(
        """
        SELECT f.HomeGoals AS homeGoals, f.AwayGoals AS awayGoals, f.CompetitionType AS competitionType, f.Season AS season,
               CASE WHEN f.HomeTeamId=@rm THEN at.Name ELSE ht.Name END AS opponent,
               CASE WHEN f.HomeTeamId=@rm THEN 1 ELSE 0 END AS isHome
        FROM Fixtures f JOIN Teams ht ON f.HomeTeamId=ht.TeamId JOIN Teams at ON f.AwayTeamId=at.TeamId
        WHERE f.FixtureId=@id
        """, new { id = fixtureId, rm = RealMadridId });
    if (match is null) return Results.NotFound();

    int rmGoals = (bool)((int)match.isHome == 1) ? (int)match.homeGoals : (int)match.awayGoals;
    int oppGoals = (bool)((int)match.isHome == 1) ? (int)match.awayGoals : (int)match.homeGoals;
    string opponent = (string)match.opponent;
    string comp = match.competitionType == "UCL" ? "Champions League" : "LaLiga";
    string resultWord = rmGoals > oppGoals ? "GANA" : rmGoals < oppGoals ? "PIERDE" : "EMPATA";
    var rnd = new Random();

    var titlePool = new List<string>
    {
        $"Real Madrid {rmGoals}-{oppGoals} {opponent} | Análisis completo",
        $"¿Qué pasó en el Real Madrid vs {opponent}? Todo el análisis",
        $"Real Madrid {resultWord} ante {opponent} — {comp}",
        $"Los 5 momentos clave del Real Madrid {rmGoals}-{oppGoals} {opponent}",
        $"Real Madrid vs {opponent}: lo que las estadísticas no te dijeron",
        $"{opponent} {oppGoals}-{rmGoals} Real Madrid — análisis sin filtro",
        $"Real Madrid {rmGoals}-{oppGoals} {opponent}: la verdad detrás del marcador",
        $"3 cosas que cambian de cara al siguiente partido tras el {rmGoals}-{oppGoals} ante {opponent}",
        $"Real Madrid vs {opponent}: quién ganó y quién perdió el partido individual",
        $"¿{(resultWord.ToLower() == "gana" ? "Victoria merecida" : resultWord.ToLower() == "empata" ? "Empate justo" : "Derrota inmerecida")}? Real Madrid {rmGoals}-{oppGoals} {opponent}",
    };
    var titles = titlePool.OrderBy(_ => rnd.Next()).Take(3).ToList();

    var hashtagPool = new List<string>
    {
        "#RealMadrid", "#HalaMadrid", $"#{opponent.Replace(" ", "")}",
        match.competitionType == "UCL" ? "#UCL" : "#LaLiga", "#Futbol", "#ElClasico",
        "#LaLigaEA", "#RMCF", "#FutbolEspañol", "#MatchDay", "#RealMadridCF", "#Podcast",
    };
    var hashtags = hashtagPool.Distinct().OrderBy(_ => rnd.Next()).Take(6).ToList();

    var goals = (await conn.QueryAsync<dynamic>(
        "SELECT PlayerName AS playerName, AssistPlayerName AS assistPlayerName, Minute AS minute, TeamId AS teamId FROM MatchEvents2 WHERE FixtureId=@id AND EventType='Goal' ORDER BY Minute",
        new { id = fixtureId })).Where(g => (int)g.teamId == RealMadridId).ToList();

    var ratings = (await conn.QueryAsync<dynamic>(
        "SELECT p.PlayerId AS playerId, p.Name AS name, mr.AiRating AS aiRating FROM MatchPlayerRatings mr JOIN Players p ON mr.PlayerId=p.PlayerId WHERE mr.FixtureId=@id ORDER BY mr.AiRating DESC",
        new { id = fixtureId })).ToList();

    string Pick(params string[] opts) => opts[rnd.Next(opts.Length)];

    var talkingPoints = new List<string>();
    var opener = Pick(
            $"Arranca contando el resultado: Real Madrid {resultWord.ToLower()} {rmGoals}-{oppGoals} frente a {opponent} en {comp}.",
            $"Abre fuerte: {rmGoals}-{oppGoals} ante {opponent}, {comp} — di de entrada si el marcador reflejó lo que pasó en la cancha o no.",
            $"Contexto rápido antes de entrar al detalle: {comp}, Real Madrid {resultWord.ToLower()} {rmGoals}-{oppGoals} contra {opponent}.",
            $"Sin rodeos: {rmGoals}-{oppGoals} contra {opponent} en {comp}. Ahora sí, vamos al porqué.",
            $"Dato duro primero, opinión después: {rmGoals}-{oppGoals} ante {opponent} ({comp}). Lo demás se explica solo con la cancha.",
            $"El titular es {rmGoals}-{oppGoals} ante {opponent}, pero el episodio de hoy va de lo que ese marcador no cuenta."
    );
    if (goals.Count > 0)
    {
        var scorers = string.Join(", ", goals.Select(g => (string)g.playerName));
        talkingPoints.Add(Pick(
            $"Menciona quién anotó: {scorers}. Vale la pena describir la jugada del primer gol con más detalle, es lo que más recuerda la gente.",
            $"Repasa los goles en orden ({scorers}) y elige UNO para analizar jugada por jugada — no los trates todos igual.",
            $"Los goleadores fueron {scorers}. Pregúntate en voz alta: ¿fue mérito individual o construcción colectiva?",
            $"{scorers} se repartieron los goles — di cuál te gustó más a nivel futbolístico, no solo el más importante en el marcador.",
            $"Antes de pasar de página: {scorers} anotaron. ¿Alguno rompió una sequía o venía de racha? Eso también es la noticia."
        ));

        var assists = goals.Where(g => g.assistPlayerName != null).Select(g => (string)g.assistPlayerName).Distinct().ToList();
        if (assists.Count > 0)
        {
            var assistList = string.Join(", ", assists);
            talkingPoints.Add(Pick(
                $"No te saltes las asistencias: {assistList}. Un gol se cuenta con el que la mete, pero el episodio se enriquece con el que la dio.",
                $"Dale crédito aparte a {assistList} en la asistencia — separa mentalmente ejecución de construcción de la jugada.",
                $"{assistList} aparece en las asistencias del partido. Vale la pena reconstruir esa jugada en voz alta, minuto a minuto."
            ));
        }
    }
    if (ratings.Count > 0)
    {
        talkingPoints.Add(Pick(
            $"Destaca a {ratings[0].name} como la figura del partido (mejor calificación real: {ratings[0].aiRating}) — explica qué hizo diferente.",
            $"{ratings[0].name} fue el mejor calificado ({ratings[0].aiRating}) — dale 30-40 segundos exclusivos, con un ejemplo concreto de su partido.",
            $"No des por sentado que {ratings[0].name} fue el mejor solo porque el dato lo dice ({ratings[0].aiRating}) — argumenta si estás de acuerdo o no.",
            $"{ratings[0].name} lideró las calificaciones con {ratings[0].aiRating} — compáralo con su rendimiento en los últimos partidos, ¿es su techo o ya es su nivel normal?",
            $"Arranca el bloque de individuales por {ratings[0].name} ({ratings[0].aiRating}), el mejor calificado — y explica con un ejemplo concreto por qué."
        ));
        if (ratings.Count > 1)
        {
            // Comparar contra el promedio de temporada del propio jugador (no solo contra sus
            // compañeros de hoy) da un gancho editorial mejor: "su peor partido en N jornadas"
            // pega más que "el más bajo de hoy", que es cierto pero poco interesante por sí solo.
            int worstPlayerId = (int)ratings[^1].playerId;
            var seasonAvg = await conn.QuerySingleOrDefaultAsync<decimal?>(
                """
                SELECT AVG(mr.AiRating) FROM MatchPlayerRatings mr
                JOIN Fixtures f ON mr.FixtureId = f.FixtureId
                WHERE mr.PlayerId=@pid AND f.Season=@season AND mr.FixtureId<>@id
                """, new { pid = worstPlayerId, season = (int)match.season, id = fixtureId });

            if (seasonAvg is decimal avg && Math.Abs((decimal)ratings[^1].aiRating - avg) >= 0.5m)
            {
                var delta = ((decimal)ratings[^1].aiRating - avg).ToString("0.0");
                talkingPoints.Add(Pick(
                    $"{ratings[^1].name} sacó {ratings[^1].aiRating}, bien por debajo de su promedio de temporada ({avg:0.0}) — dile a la audiencia si fue un mal día puntual o algo que ya venías notando.",
                    $"No es solo 'el más bajo de hoy': {ratings[^1].name} está {delta} puntos por debajo de su propio promedio de temporada ({avg:0.0}). Eso sí es una historia.",
                    $"Compara: {ratings[^1].name} promedia {avg:0.0} en la temporada y hoy sacó {ratings[^1].aiRating} — ¿lesión, cansancio, o simplemente mal partido?"
                ));
            }
            else
            {
                talkingPoints.Add(Pick(
                    $"Sé honesto sobre el más flojo, {ratings[^1].name} ({ratings[^1].aiRating}) — el análisis crítico es lo que distingue a un buen podcast de uno de solo elogios.",
                    $"Toca el punto incómodo: {ratings[^1].name} tuvo la calificación más baja ({ratings[^1].aiRating}). Sé justo, no cruel — contexto antes que crítica.",
                    $"Pregunta abierta para la audiencia: ¿{ratings[^1].name} ({ratings[^1].aiRating}) tuvo mala suerte o mal partido de verdad?",
                    $"{ratings[^1].name} cerró con la calificación más baja ({ratings[^1].aiRating}) — dile a la audiencia si fue un problema puntual o algo que ya venías notando.",
                    $"No cierres el bloque de individuales sin mencionar a {ratings[^1].name} ({ratings[^1].aiRating}) — el silencio sobre el más flojo también se nota."
                ));
            }
        }
    }
    talkingPoints.Add(Pick(
        "Cierra con una línea sobre el próximo rival y qué esperar — deja al oyente con una razón para volver al siguiente episodio.",
        "Termina con una predicción corta y arriesgada sobre el siguiente partido — genera conversación en los comentarios.",
        "Cierra pidiendo la opinión de la audiencia: ¿qué calificación le pondrían ustedes al partido del 1 al 10?",
        "Remata invitando a comentar con un dato concreto: pide que voten quién fue el MVP del partido para ustedes.",
        "Cierra mirando hacia adelante: qué tendría que cambiar (o repetirse) en el próximo partido para que el resultado sea distinto."
    ));
    // el punto de apertura (resultado) siempre va primero, sin importar el barajado del resto --
    // se guarda aparte desde su creación en vez de re-detectarlo por texto (frágil con más variantes)
    talkingPoints = talkingPoints.OrderBy(_ => rnd.Next()).ToList();
    talkingPoints.Insert(0, opener);

    // Guion con tiempos aproximados -- un orden sugerido ayuda más al grabar que una
    // lista plana de puntos sueltos. Los minutos son una guía, no una regla fija.
    var outline = new List<object>
    {
        new { block = "Intro", minutes = 1, note = "Encuadre rápido: rival, competición, resultado." },
        new { block = "Resultado", minutes = 2, note = "El punto de apertura de arriba." },
        new { block = "Individuales", minutes = 5, note = "Mejor y peor calificado, goles y asistencias." },
        new { block = "Cierre", minutes = 2, note = "El último punto de la lista, mirando al próximo partido." },
    };

    // Clips cortos sugeridos para redes (Reels/Shorts/TikTok) a partir de los goles reales
    // del partido -- usa el mismo dato de minuto que ya se consultaba para MatchEvents2 y
    // que hasta ahora solo se usaba para el talking point, no para sugerir recortes.
    var clipSuggestions = goals.Select(g =>
    {
        int minute = (int)g.minute;
        int from = Math.Max(0, minute - 1);
        return new
        {
            label = $"Gol de {(string)g.playerName} (min. {minute})",
            fromMinute = from,
            toMinute = minute + 1,
        };
    }).ToList();

    return Results.Ok(new { titles, hashtags, talkingPoints, outline, clipSuggestions });
});

app.MapGet("/api/matches/{fixtureId:int}/detail", async (Func<IDbConnection> factory, int fixtureId) =>
{
    using var conn = factory();
    var match = await conn.QuerySingleOrDefaultAsync<dynamic>(
        """
        SELECT f.FixtureId AS fixtureId, f.KickoffUtc AS kickoffUtc, f.RoundLabel AS roundLabel,
               f.CompetitionType AS competitionType, f.HomeGoals AS homeGoals, f.AwayGoals AS awayGoals,
               ht.Name AS homeTeam, ht.TeamId AS homeTeamId, at.Name AS awayTeam, at.TeamId AS awayTeamId,
               l.Name AS leagueName
        FROM Fixtures f
        JOIN Teams ht ON f.HomeTeamId = ht.TeamId
        JOIN Teams at ON f.AwayTeamId = at.TeamId
        JOIN Leagues l ON f.LeagueId = l.LeagueId
        WHERE f.FixtureId = @id
        """, new { id = fixtureId });
    if (match is null) return Results.NotFound();

    var lineups = await conn.QueryAsync<dynamic>(
        "SELECT TeamId AS teamId, CoachName AS coachName, Formation AS formation FROM MatchLineups WHERE FixtureId=@id",
        new { id = fixtureId });
    var players = await conn.QueryAsync<dynamic>(
        """
        SELECT TeamId AS teamId, PlayerId AS playerId, PlayerName AS playerName, ShirtNumber AS shirtNumber,
               PosCode AS posCode, GridSlot AS gridSlot, IsStarter AS isStarter
        FROM MatchLineupPlayers WHERE FixtureId=@id ORDER BY IsStarter DESC, ShirtNumber
        """, new { id = fixtureId });
    var events = await conn.QueryAsync<dynamic>(
        """
        SELECT TeamId AS teamId, Minute AS minute, ExtraMinute AS extraMinute, PlayerName AS playerName,
               AssistPlayerName AS assistPlayerName, EventType AS eventType, EventDetail AS eventDetail
        FROM MatchEvents2 WHERE FixtureId=@id ORDER BY Minute
        """, new { id = fixtureId });

    return Results.Ok(new { match, lineups, players, events });
});

app.MapGet("/api/matches/{fixtureId:int}/mvp", async (Func<IDbConnection> factory, int fixtureId) =>
{
    using var conn = factory();
    var ratings = await conn.QueryAsync<dynamic>(
        """
        SELECT p.Name AS name, mr.AiRating AS aiRating
        FROM MatchPlayerRatings mr JOIN Players p ON mr.PlayerId = p.PlayerId
        WHERE mr.FixtureId=@id ORDER BY mr.AiRating DESC
        """, new { id = fixtureId });
    var list = ratings.ToList();
    return Results.Ok(new { mvp = list.FirstOrDefault(), worst = list.LastOrDefault() });
});

app.MapGet("/api/lineups/departed-since-last", async (Func<IDbConnection> factory) =>
{
    using var conn = factory();
    var departed = await conn.QueryAsync<dynamic>(
        $"""
        SELECT DISTINCT mlp.PlayerId AS playerId, mlp.PlayerName AS playerName
        FROM MatchLineupPlayers mlp
        WHERE mlp.TeamId = @rm
        AND mlp.FixtureId = (
            SELECT {Top(1)} FixtureId FROM Fixtures
            WHERE (HomeTeamId=@rm OR AwayTeamId=@rm) AND StatusShort='FT'
            AND FixtureId IN (SELECT DISTINCT FixtureId FROM MatchLineups)
            ORDER BY KickoffUtc DESC
            {Limit(1)}
        )
        AND NOT EXISTS (SELECT 1 FROM Players p WHERE p.PlayerId = mlp.PlayerId AND p.IsCurrentSquad = 1)
        """, new { rm = RealMadridId });
    return Results.Ok(departed);
});

app.MapGet("/api/lineups/last-played", async (Func<IDbConnection> factory) =>
{
    using var conn = factory();
    var lastFixture = await conn.QuerySingleOrDefaultAsync<int?>(
        $"""
        SELECT {Top(1)} FixtureId FROM Fixtures
        WHERE (HomeTeamId=@rm OR AwayTeamId=@rm) AND StatusShort='FT'
        AND FixtureId IN (SELECT DISTINCT FixtureId FROM MatchLineups)
        ORDER BY KickoffUtc DESC
        {Limit(1)}
        """, new { rm = RealMadridId });
    if (lastFixture is null) return Results.Ok(new { slots = Array.Empty<object>() });

    var starters = await conn.QueryAsync<dynamic>(
        """
        SELECT mlp.PlayerId AS playerId, mlp.PlayerName AS playerName, mlp.PosCode AS posCode, mlp.GridSlot AS gridSlot
        FROM MatchLineupPlayers mlp
        JOIN Players p ON mlp.PlayerId = p.PlayerId
        WHERE mlp.FixtureId=@fid AND mlp.TeamId=@rm AND mlp.IsStarter=1 AND p.IsCurrentSquad = 1
        """, new { fid = lastFixture, rm = RealMadridId });

    return Results.Ok(new { fixtureId = lastFixture, slots = starters });
});

// Transcripción local (voz-a-texto) de la grabación del podcast, para armar shownotes/
// descripción de YouTube sin escuchar todo de nuevo. Sube el AUDIO ya extraído (el
// frontend lo recorta del video con ffmpeg.wasm antes de mandarlo, para no subir el video
// completo) y corre faster-whisper contra el venv de ml-service -- por ahora solo funciona
// en el entorno de desarrollo (dotnet run), no en la app instalada: faster-whisper es una
// dependencia pesada que todavía no se agregó al Python portátil del instalador.
app.MapPost("/api/media/transcribe", async (IFormFile audio) =>
{
    var repoRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));
    var venvPython = Path.Combine(repoRoot, "ml-service", ".venv", "Scripts", "python.exe");
    var scriptPath = Path.Combine(repoRoot, "ml-service", "data", "transcribe.py");

    if (!File.Exists(venvPython) || !File.Exists(scriptPath))
    {
        return Results.Problem(
            "Transcripción no disponible en este entorno -- falta ml-service/.venv o transcribe.py. " +
            "Solo funciona corriendo la API en modo desarrollo por ahora.",
            statusCode: 501);
    }

    var tempPath = Path.Combine(Path.GetTempPath(), $"madrid-transcribe-{Guid.NewGuid():N}{Path.GetExtension(audio.FileName)}");
    await using (var stream = File.Create(tempPath))
    {
        await audio.CopyToAsync(stream);
    }

    try
    {
        var psi = new System.Diagnostics.ProcessStartInfo
        {
            FileName = venvPython,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = System.Text.Encoding.UTF8,
            StandardErrorEncoding = System.Text.Encoding.UTF8,
            CreateNoWindow = true,
        };
        psi.ArgumentList.Add(scriptPath);
        psi.ArgumentList.Add(tempPath);
        psi.EnvironmentVariables["PYTHONIOENCODING"] = "utf-8";
        psi.EnvironmentVariables["PYTHONUTF8"] = "1";

        using var proc = new System.Diagnostics.Process { StartInfo = psi };
        var stdout = new System.Text.StringBuilder();
        var stderr = new System.Text.StringBuilder();
        proc.OutputDataReceived += (_, e) => { if (e.Data != null) stdout.AppendLine(e.Data); };
        proc.ErrorDataReceived += (_, e) => { if (e.Data != null) stderr.AppendLine(e.Data); };
        proc.Start();
        proc.BeginOutputReadLine();
        proc.BeginErrorReadLine();
        // Sin timeout explícito -- transcribir varios minutos de audio en CPU puede tardar
        // varios minutos; es un flujo manual de un solo usuario, no un endpoint de alto tráfico.
        await proc.WaitForExitAsync();

        if (proc.ExitCode != 0)
        {
            return Results.Problem($"La transcripción falló: {stderr}", statusCode: 500);
        }
        return Results.Ok(new { transcript = stdout.ToString().Trim() });
    }
    finally
    {
        try { File.Delete(tempPath); } catch { /* archivo temporal, no crítico */ }
    }
})
// ASP.NET Core exige antiforgery por defecto en cualquier endpoint que reciba IFormFile,
// incluso sin AddAntiforgery() registrado -- sin esto, la request truena con
// InvalidOperationException antes de llegar al handler. No hace falta protección CSRF
// real aquí: es un endpoint local de un solo usuario, sin sesión ni cookies de por medio.
.DisableAntiforgery();

app.MapPost("/api/media/log", async (Func<IDbConnection> factory, MediaLogRequest req) =>
{
    using var conn = factory();
    await conn.ExecuteAsync(
        "INSERT INTO GeneratedMedia (Kind, FileName, FixtureId) VALUES (@kind, @fileName, @fixtureId)",
        new { kind = req.Kind, fileName = req.FileName, fixtureId = req.FixtureId });
    return Results.Ok(new { ok = true });
});

app.MapGet("/api/media/history", async (Func<IDbConnection> factory) =>
{
    using var conn = factory();
    var rows = await conn.QueryAsync<dynamic>(
        $"""
        SELECT {Top(30)} MediaId AS mediaId, Kind AS kind, FileName AS fileName, FixtureId AS fixtureId, CreatedAtUtc AS createdAtUtc
        FROM GeneratedMedia ORDER BY CreatedAtUtc DESC
        {Limit(30)}
        """);
    return Results.Ok(rows);
});

app.MapGet("/api/admin/db-provider", () => Results.Ok(new { provider = isSqlite ? "sqlite" : "sqlserver" }));

var refreshState = new RefreshState();

// Corre el Python portátil (bundled en el instalable) contra el mismo madrid.db
// que ya usa la API -- solo tiene sentido en la app instalada (SQLite), donde
// el usuario controla su propia API key en scripts\.env.
app.MapPost("/api/admin/refresh-data", () =>
{
    if (!isSqlite) return Results.BadRequest(new { error = "Solo disponible en la app instalada (SQLite)." });

    lock (refreshState)
    {
        if (refreshState.Running) return Results.Conflict(new { error = "Ya hay una actualización en curso." });
        refreshState.Running = true;
        refreshState.Finished = false;
        refreshState.ExitCode = null;
        refreshState.Log.Clear();
    }

    var appRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, ".."));
    var pythonExe = Path.Combine(appRoot, "runtime", "python", "python.exe");
    var scriptPath = Path.Combine(appRoot, "scripts", "refresh_current.py");
    var envPath = Path.Combine(appRoot, "scripts", ".env");

    if (!File.Exists(pythonExe) || !File.Exists(scriptPath))
    {
        lock (refreshState)
        {
            refreshState.Running = false;
            refreshState.Finished = true;
            refreshState.ExitCode = -1;
            refreshState.Log.Add("No se encontró el Python portátil o el script -- ¿está instalado desde el instalador oficial?");
        }
        return Results.Ok(new { started = true });
    }

    // Chequeo previo en vez de dejar que el script Python truene con un KeyError crudo --
    // mismo resultado (no arranca), pero con un mensaje que el usuario puede accionar de una:
    // pegar su key en /podcast (ver POST /api/admin/api-key) en vez de leer un traceback.
    if (!HasRealApiKey(envPath))
    {
        lock (refreshState)
        {
            refreshState.Running = false;
            refreshState.Finished = true;
            refreshState.ExitCode = -1;
            refreshState.Log.Add("Falta tu API key de api-football.com. Guárdala desde el aviso en pantalla o pégala en scripts\\.env y vuelve a intentar.");
        }
        return Results.Ok(new { started = true });
    }

    var psi = new System.Diagnostics.ProcessStartInfo
    {
        FileName = pythonExe,
        Arguments = $"-u \"{scriptPath}\"",
        UseShellExecute = false,
        RedirectStandardOutput = true,
        RedirectStandardError = true,
        StandardOutputEncoding = System.Text.Encoding.UTF8,
        StandardErrorEncoding = System.Text.Encoding.UTF8,
        CreateNoWindow = true,
    };
    psi.EnvironmentVariables["SQLITE_PATH"] = sqlitePath;
    psi.EnvironmentVariables["PYTHONIOENCODING"] = "utf-8";
    psi.EnvironmentVariables["PYTHONUTF8"] = "1";

    var proc = new System.Diagnostics.Process { StartInfo = psi, EnableRaisingEvents = true };
    proc.OutputDataReceived += (_, e) => { if (e.Data != null) lock (refreshState) refreshState.Log.Add(e.Data); };
    proc.ErrorDataReceived += (_, e) => { if (e.Data != null) lock (refreshState) refreshState.Log.Add("! " + e.Data); };
    proc.Exited += (_, _) =>
    {
        lock (refreshState)
        {
            refreshState.Running = false;
            refreshState.Finished = true;
            refreshState.ExitCode = proc.ExitCode;
        }
        proc.Dispose();
    };
    proc.Start();
    proc.BeginOutputReadLine();
    proc.BeginErrorReadLine();

    return Results.Ok(new { started = true });
});

app.MapGet("/api/admin/refresh-status", () =>
{
    lock (refreshState)
    {
        return Results.Ok(new { running = refreshState.Running, finished = refreshState.Finished, exitCode = refreshState.ExitCode, log = refreshState.Log.ToArray() });
    }
});

// Detecta si scripts\.env ya tiene una API key real (no la plantilla) sin necesitar
// arrancar el Python portátil -- deja al frontend avisar de una vez en vez de que el
// usuario se entere recién al presionar "Actualizar datos" y ver un log de error.
bool HasRealApiKey(string envPath)
{
    if (!File.Exists(envPath)) return false;
    foreach (var line in File.ReadAllLines(envPath))
    {
        var trimmed = line.Trim();
        if (!trimmed.StartsWith("API_FOOTBALL_KEY=")) continue;
        var value = trimmed["API_FOOTBALL_KEY=".Length..].Trim();
        return value.Length > 0 && value != "pega-aqui-tu-api-key";
    }
    return false;
}

app.MapGet("/api/admin/api-key-status", () =>
{
    if (!isSqlite) return Results.Ok(new { applicable = false, configured = true });
    var envPath = Path.Combine(AppContext.BaseDirectory, "..", "scripts", ".env");
    return Results.Ok(new { applicable = true, configured = HasRealApiKey(envPath) });
});

// Guarda la API key de api-football.com en scripts\.env sin que el usuario tenga que
// navegar carpetas de instalación a mano -- solo aplica a la app instalada (SQLite);
// en desarrollo la key se sigue pegando directamente en ml-service/.env.
app.MapPost("/api/admin/api-key", (ApiKeyRequest req) =>
{
    if (!isSqlite) return Results.BadRequest(new { error = "Solo disponible en la app instalada (SQLite)." });
    var key = req.ApiKey?.Trim() ?? "";
    if (key.Length == 0) return Results.BadRequest(new { error = "La API key no puede estar vacía." });

    var scriptsDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "scripts"));
    var envPath = Path.Combine(scriptsDir, ".env");
    var envExamplePath = Path.Combine(scriptsDir, ".env.example");

    var lines = (File.Exists(envPath) ? File.ReadAllLines(envPath)
        : File.Exists(envExamplePath) ? File.ReadAllLines(envExamplePath)
        : new[] { "API_FOOTBALL_KEY=", "API_FOOTBALL_BASE=https://v3.football.api-sports.io", "REAL_MADRID_TEAM_ID=541", "LALIGA_LEAGUE_ID=140" }).ToList();

    var idx = lines.FindIndex(l => l.TrimStart().StartsWith("API_FOOTBALL_KEY="));
    if (idx >= 0) lines[idx] = $"API_FOOTBALL_KEY={key}";
    else lines.Insert(0, $"API_FOOTBALL_KEY={key}");

    Directory.CreateDirectory(scriptsDir);
    File.WriteAllLines(envPath, lines);
    return Results.Ok(new { saved = true });
});

app.Run();

record SaveLineupRequest(int FixtureId, string Formation, List<LineupSlot> Slots);
record RatingRequest(int FixtureId, int PlayerId, decimal Rating, string? Review);
record PodcastLogRequest(int FixtureId, string Title, string EpisodeLabel, string YoutubeLink);
record LineupSlot(string SlotPosition, int PlayerId);
record MediaLogRequest(string Kind, string FileName, int? FixtureId);
record ApiKeyRequest(string ApiKey);
record EpisodeMetricRequest(int ViewsCount);

class RefreshState
{
    public bool Running;
    public bool Finished;
    public int? ExitCode;
    public List<string> Log = new();
}

// Necesario para que WebApplicationFactory<Program> (api.Tests) pueda arrancar la app
// en proceso -- con top-level statements, la clase Program que el compilador genera es
// internal por defecto y no se puede referenciar desde otro assembly sin esto.
public partial class Program { }
