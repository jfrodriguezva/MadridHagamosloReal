using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;

namespace Madrid.Api.Tests;

// /api/predictions/next/value (escribe) y /api/predictions/value-track-record (lee) --
// cubre el punto más fácil de arruinar: el "lado" (H/D/A) que corresponde a cada
// mercado depende de si el Real Madrid jugaba de local o de visita en ESE partido
// puntual, no es fijo por nombre de mercado.
public class ValueBetTrackingTests : IAsyncLifetime
{
    private const int RealMadridId = 541;
    private string _dbPath = null!;
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public async Task InitializeAsync()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"madrid-valuebet-test-{Guid.NewGuid():N}.db");
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
                HomeGoals INTEGER, AwayGoals INTEGER, StatusShort TEXT, KickoffUtc TEXT);
            CREATE TABLE Predictions (PredictionId INTEGER PRIMARY KEY, FixtureId INTEGER, Market TEXT,
                ProbHome REAL, ProbDraw REAL, ProbAway REAL, ActualOutcome TEXT, WasCorrect INTEGER);
            CREATE TABLE OddsSnapshots (OddsSnapshotId INTEGER PRIMARY KEY, FixtureId INTEGER, Bookmaker TEXT,
                OddHome REAL, OddDraw REAL, OddAway REAL, ImpliedHome REAL, ImpliedDraw REAL, ImpliedAway REAL);
            CREATE TABLE ValueBetLog (FixtureId INTEGER PRIMARY KEY, Market TEXT, RecommendedSide TEXT,
                ModelProb REAL, MarketProb REAL, EdgePct REAL, LoggedAtUtc TEXT);

            INSERT INTO Teams (TeamId, Name) VALUES ({RealMadridId}, 'Real Madrid'), (1, 'Rival A'), (2, 'Rival B');

            -- Real Madrid de VISITA, sin jugar todavia (StatusShort='NS') -- el modelo da
            -- mucha más probabilidad de que gane el Madrid (visitante) que lo que implica
            -- el mercado, así que el "value bet" correcto debería recomendar lado 'A'
            -- (gana el equipo visitante = Real Madrid), no 'H'.
            INSERT INTO Fixtures (FixtureId, HomeTeamId, AwayTeamId, StatusShort, KickoffUtc)
                VALUES (200, 1, {RealMadridId}, 'NS', '2026-01-01T20:00:00Z');
            INSERT INTO Predictions (FixtureId, Market, ProbHome, ProbDraw, ProbAway)
                VALUES (200, '1X2', 0.15, 0.20, 0.65);
            INSERT INTO OddsSnapshots (FixtureId, Bookmaker, OddHome, OddDraw, OddAway, ImpliedHome, ImpliedDraw, ImpliedAway)
                VALUES (200, 'TestBook', 5.0, 4.0, 1.5, 0.20, 0.25, 0.55);

            -- Partido YA jugado (para probar value-track-record): Real Madrid de local,
            -- gano (ActualOutcome='H'), y el value bet guardado ya recomendaba 'H'.
            INSERT INTO Fixtures (FixtureId, HomeTeamId, AwayTeamId, HomeGoals, AwayGoals, StatusShort, KickoffUtc)
                VALUES (201, {RealMadridId}, 2, 2, 0, 'FT', '2025-12-01T20:00:00Z');
            INSERT INTO Predictions (FixtureId, Market, ActualOutcome, WasCorrect) VALUES (201, '1X2', 'H', 1);
            INSERT INTO ValueBetLog (FixtureId, Market, RecommendedSide, ModelProb, MarketProb, EdgePct)
                VALUES (201, 'Gana el Real Madrid', 'H', 0.60, 0.50, 10.0);
            """;
        await cmd.ExecuteNonQueryAsync();
    }

    [Fact]
    public async Task Next_value_resolves_the_recommended_side_relative_to_the_actual_home_away_status()
    {
        // fixture 200: Real Madrid juega de VISITA -- el mercado que gana debe ser
        // "Gana el Real Madrid" con RecommendedSide='A', nunca 'H'.
        var res = await _client.GetAsync("/api/predictions/next/value");
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("hasValue").GetBoolean());
        Assert.Equal("Gana el Real Madrid", body.GetProperty("market").GetString());

        // Verificamos lo que quedó escrito en ValueBetLog directamente en la base.
        using var conn = new SqliteConnection($"Data Source={_dbPath}");
        await conn.OpenAsync();
        var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT RecommendedSide FROM ValueBetLog WHERE FixtureId=200";
        var side = (string?)await cmd.ExecuteScalarAsync();
        Assert.Equal("A", side);
    }

    [Fact]
    public async Task Value_track_record_counts_a_matching_side_as_correct()
    {
        var res = await _client.GetAsync("/api/predictions/value-track-record");
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        var overall = body.GetProperty("overall");
        Assert.Equal(1, overall.GetProperty("total").GetInt32());
        Assert.Equal(1, overall.GetProperty("correct").GetInt32());
    }
}
