using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;

namespace Madrid.Api.Tests;

// GET /api/dashboard/next-match -- antes "recentForm" mezclaba Liga y Champions en los
// mismos "últimos 5", lo que puede engañar más de lo que ayuda (un resultado contra un
// rival de Liga no dice lo mismo que uno de Champions). Este test fija que la racha por
// competición filtra correctamente y no se contamina entre sí.
public class RecentFormByCompetitionTests : IAsyncLifetime
{
    private const int RealMadridId = 541;
    private string _dbPath = null!;
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public async Task InitializeAsync()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"madrid-recentform-test-{Guid.NewGuid():N}.db");
        await SeedAsync(_dbPath);

        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("DB_PROVIDER", "sqlite");
            builder.UseSetting("SQLITE_PATH", _dbPath);
        });
        _client = _factory.CreateClient();
    }

    public Task DisposeAsync()
    {
        _client.Dispose();
        _factory.Dispose();
        try { File.Delete(_dbPath); } catch { }
        return Task.CompletedTask;
    }

    private static async Task SeedAsync(string path)
    {
        using var conn = new SqliteConnection($"Data Source={path}");
        await conn.OpenAsync();
        var cmd = conn.CreateCommand();
        cmd.CommandText = $"""
            CREATE TABLE Teams (TeamId INTEGER PRIMARY KEY, Name TEXT);
            CREATE TABLE Fixtures (FixtureId INTEGER PRIMARY KEY, HomeTeamId INTEGER, AwayTeamId INTEGER,
                HomeGoals INTEGER, AwayGoals INTEGER, StatusShort TEXT, KickoffUtc TEXT, RoundLabel TEXT, CompetitionType TEXT);
            CREATE TABLE Predictions (PredictionId INTEGER PRIMARY KEY, FixtureId INTEGER, Market TEXT,
                ProbHome REAL, ProbDraw REAL, ProbAway REAL, ActualOutcome TEXT, WasCorrect INTEGER);

            INSERT INTO Teams (TeamId, Name) VALUES ({RealMadridId}, 'Real Madrid'), (1, 'Rival Liga'), (2, 'Rival Champions');

            -- 2 partidos de Liga (ambos ganados) y 1 de Champions (perdido) -- mezclados,
            -- "últimos 3" combinado seria [L, W, W] (Champions primero cronológicamente aquí);
            -- separado por competición, Liga debe ser puro [W, W] y Champions puro [L].
            INSERT INTO Fixtures (FixtureId, HomeTeamId, AwayTeamId, HomeGoals, AwayGoals, StatusShort, KickoffUtc, CompetitionType)
                VALUES (100, {RealMadridId}, 1, 2, 0, 'FT', '2026-01-01T20:00:00Z', 'LEAGUE');
            INSERT INTO Fixtures (FixtureId, HomeTeamId, AwayTeamId, HomeGoals, AwayGoals, StatusShort, KickoffUtc, CompetitionType)
                VALUES (101, 2, {RealMadridId}, 3, 1, 'FT', '2026-01-05T20:00:00Z', 'UCL');
            INSERT INTO Fixtures (FixtureId, HomeTeamId, AwayTeamId, HomeGoals, AwayGoals, StatusShort, KickoffUtc, CompetitionType)
                VALUES (102, {RealMadridId}, 1, 1, 0, 'FT', '2026-01-10T20:00:00Z', 'LEAGUE');

            -- próximo partido pendiente, para que el endpoint no responda 404
            INSERT INTO Fixtures (FixtureId, HomeTeamId, AwayTeamId, StatusShort, KickoffUtc, RoundLabel, CompetitionType)
                VALUES (200, {RealMadridId}, 1, 'NS', '2026-02-01T20:00:00Z', 'Jornada 1', 'LEAGUE');
            """;
        await cmd.ExecuteNonQueryAsync();
    }

    [Fact]
    public async Task RecentFormLeagueAndChampions_do_not_cross_contaminate()
    {
        var res = await _client.GetAsync("/api/dashboard/next-match");
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();

        var league = body.GetProperty("recentFormLeague").EnumerateArray().Select(e => e.GetString()).ToList();
        var champions = body.GetProperty("recentFormChampions").EnumerateArray().Select(e => e.GetString()).ToList();
        var overall = body.GetProperty("recentForm").EnumerateArray().Select(e => e.GetString()).ToList();

        Assert.Equal(new[] { "W", "W" }, league);
        Assert.Equal(new[] { "L" }, champions);
        Assert.Equal(3, overall.Count); // el combinado sí mezcla las 3, a propósito
    }
}
