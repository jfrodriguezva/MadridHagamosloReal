using System.Data;
using Dapper;
using Microsoft.Data.Sqlite;
using Microsoft.Data.SqlClient;

var builder = WebApplication.CreateBuilder(args);

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

string? connString = null;
bool usingDefaultConnString = false;

var sqlitePath = builder.Configuration["SQLITE_PATH"] ?? Environment.GetEnvironmentVariable("SQLITE_PATH") ?? "madrid.db";

if (isSqlite)
{
    var sqliteConnString = $"Data Source={sqlitePath}";
    builder.Services.AddSingleton<Func<IDbConnection>>(() => new SqliteConnection(sqliteConnString));
}
else
{
    // La cadena de conexión trae credenciales, así que NUNCA se escribe aquí.
    // Se busca en este orden:
    //   1. Configuración "ConnectionStrings:MadridDb" -- appsettings.json, la
    //      variable de entorno ConnectionStrings__MadridDb, los user-secrets
    //      (solo en Development) o --ConnectionStrings:MadridDb=... al arrancar.
    //   2. Variable de entorno MADRID_DB_CONNECTION -- funciona sin importar el
    //      ASPNETCORE_ENVIRONMENT, que es el caso cuando la app WPF lanza la API
    //      en desarrollo (ver desktop/MainWindow.xaml.cs, EnsureApiRunning).
    // Lo cómodo para desarrollo es guardarla una sola vez, fuera del repo:
    //   cd api && dotnet user-secrets set "ConnectionStrings:MadridDb" "<cadena>"
    connString = builder.Configuration.GetConnectionString("MadridDb")
        ?? Environment.GetEnvironmentVariable("MADRID_DB_CONNECTION");

    // Sin nada configurado se usa un default LOCAL y SIN CONTRASEÑA (autenticación
    // integrada de Windows): no es un secreto, así que puede vivir en el código, y
    // basta para un SQL Server de desarrollo en la propia máquina. Si tu instancia
    // usa usuario/contraseña de SQL, configura la cadena con cualquiera de los dos
    // mecanismos de arriba -- el aviso al arrancar te lo recuerda.
    usingDefaultConnString = string.IsNullOrWhiteSpace(connString);
    if (usingDefaultConnString)
        connString = "Server=localhost;Database=MadridHagamosloReal;Trusted_Connection=True;TrustServerCertificate=True;";

    builder.Services.AddSingleton<Func<IDbConnection>>(() => new SqlConnection(connString!));
}

var app = builder.Build();

if (usingDefaultConnString)
    app.Logger.LogWarning(
        "Sin cadena de conexión configurada: usando el default local con autenticación integrada de Windows. " +
        "Si tu SQL Server pide usuario/contraseña, define ConnectionStrings:MadridDb (user-secrets o " +
        "ConnectionStrings__MadridDb) o la variable de entorno MADRID_DB_CONNECTION -- ver RECOVERY.md.");

app.UseCors();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

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

    return match is null ? Results.NotFound() : Results.Ok(match);
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
    return Results.Ok(new { overall = stats, last12 = recent });
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

    return Results.Ok(new { match, x12, btts, over25 });
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

    return Results.Ok(new
    {
        hasValue = edge > 0.03,
        edgePct = Math.Round(edge * 100, 1),
        market = best.market,
        modelProbPct = Math.Round(best.modelProb * 100, 1),
        marketProbPct = Math.Round(best.marketProb * 100, 1),
    });
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
    var rows = await conn.QueryAsync<dynamic>(
        """
        SELECT PodcastId AS podcastId, FixtureId AS fixtureId, Title AS title, EpisodeLabel AS episodeLabel,
               YoutubeLink AS youtubeLink, GeneratedAtUtc AS generatedAtUtc
        FROM PodcastHistory ORDER BY GeneratedAtUtc DESC
        """);
    return Results.Ok(rows);
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

app.MapGet("/api/podcast/suggestions/{fixtureId:int}", async (Func<IDbConnection> factory, int fixtureId) =>
{
    using var conn = factory();
    var match = await conn.QuerySingleOrDefaultAsync<dynamic>(
        """
        SELECT f.HomeGoals AS homeGoals, f.AwayGoals AS awayGoals, f.CompetitionType AS competitionType,
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
        $"{opponent} {oppGoals}-{rmGoals} Real Madrid — análisis sin filtro" ,
    };
    var titles = titlePool.OrderBy(_ => rnd.Next()).Take(3).ToList();

    var hashtagPool = new List<string>
    {
        "#RealMadrid", "#HalaMadrid", $"#{opponent.Replace(" ", "")}",
        match.competitionType == "UCL" ? "#UCL" : "#LaLiga", "#Futbol", "#ElClasico",
        "#LaLigaEA", "#RMCF", "#FutbolEspañol", "#MatchDay",
    };
    var hashtags = hashtagPool.Distinct().OrderBy(_ => rnd.Next()).Take(6).ToList();

    var goals = (await conn.QueryAsync<dynamic>(
        "SELECT PlayerName AS playerName, AssistPlayerName AS assistPlayerName, Minute AS minute, TeamId AS teamId FROM MatchEvents2 WHERE FixtureId=@id AND EventType='Goal' ORDER BY Minute",
        new { id = fixtureId })).Where(g => (int)g.teamId == RealMadridId).ToList();

    var ratings = (await conn.QueryAsync<dynamic>(
        "SELECT p.Name AS name, mr.AiRating AS aiRating FROM MatchPlayerRatings mr JOIN Players p ON mr.PlayerId=p.PlayerId WHERE mr.FixtureId=@id ORDER BY mr.AiRating DESC",
        new { id = fixtureId })).ToList();

    string Pick(params string[] opts) => opts[rnd.Next(opts.Length)];

    var talkingPoints = new List<string>
    {
        Pick(
            $"Arranca contando el resultado: Real Madrid {resultWord.ToLower()} {rmGoals}-{oppGoals} frente a {opponent} en {comp}.",
            $"Abre fuerte: {rmGoals}-{oppGoals} ante {opponent}, {comp} — di de entrada si el marcador reflejó lo que pasó en la cancha o no.",
            $"Contexto rápido antes de entrar al detalle: {comp}, Real Madrid {resultWord.ToLower()} {rmGoals}-{oppGoals} contra {opponent}."
        ),
    };
    if (goals.Count > 0)
    {
        var scorers = string.Join(", ", goals.Select(g => (string)g.playerName));
        talkingPoints.Add(Pick(
            $"Menciona quién anotó: {scorers}. Vale la pena describir la jugada del primer gol con más detalle, es lo que más recuerda la gente.",
            $"Repasa los goles en orden ({scorers}) y elige UNO para analizar jugada por jugada — no los trates todos igual.",
            $"Los goleadores fueron {scorers}. Pregúntate en voz alta: ¿fue mérito individual o construcción colectiva?"
        ));
    }
    if (ratings.Count > 0)
    {
        talkingPoints.Add(Pick(
            $"Destaca a {ratings[0].name} como la figura del partido (mejor calificación real: {ratings[0].aiRating}) — explica qué hizo diferente.",
            $"{ratings[0].name} fue el mejor calificado ({ratings[0].aiRating}) — dale 30-40 segundos exclusivos, con un ejemplo concreto de su partido.",
            $"No des por sentado que {ratings[0].name} fue el mejor solo porque el dato lo dice ({ratings[0].aiRating}) — argumenta si estás de acuerdo o no."
        ));
        if (ratings.Count > 1)
            talkingPoints.Add(Pick(
                $"Sé honesto sobre el más flojo, {ratings[^1].name} ({ratings[^1].aiRating}) — el análisis crítico es lo que distingue a un buen podcast de uno de solo elogios.",
                $"Toca el punto incómodo: {ratings[^1].name} tuvo la calificación más baja ({ratings[^1].aiRating}). Sé justo, no cruel — contexto antes que crítica.",
                $"Pregunta abierta para la audiencia: ¿{ratings[^1].name} ({ratings[^1].aiRating}) tuvo mala suerte o mal partido de verdad?"
            ));
    }
    talkingPoints.Add(Pick(
        "Cierra con una línea sobre el próximo rival y qué esperar — deja al oyente con una razón para volver al siguiente episodio.",
        "Termina con una predicción corta y arriesgada sobre el siguiente partido — genera conversación en los comentarios.",
        "Cierra pidiendo la opinión de la audiencia: ¿qué calificación le pondrían ustedes al partido del 1 al 10?"
    ));
    talkingPoints = talkingPoints.OrderBy(_ => rnd.Next()).ToList();
    // el primer punto (resultado) siempre debe ir primero, sin importar el barajado
    var opener = talkingPoints.FirstOrDefault(t => t.Contains(resultWord.ToLower()) || t.Contains(comp));
    if (opener != null) { talkingPoints.Remove(opener); talkingPoints.Insert(0, opener); }

    return Results.Ok(new { titles, hashtags, talkingPoints });
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

app.Run();

record SaveLineupRequest(int FixtureId, string Formation, List<LineupSlot> Slots);
record RatingRequest(int FixtureId, int PlayerId, decimal Rating, string? Review);
record PodcastLogRequest(int FixtureId, string Title, string EpisodeLabel, string YoutubeLink);
record LineupSlot(string SlotPosition, int PlayerId);
record MediaLogRequest(string Kind, string FileName, int? FixtureId);

class RefreshState
{
    public bool Running;
    public bool Finished;
    public int? ExitCode;
    public List<string> Log = new();
}
