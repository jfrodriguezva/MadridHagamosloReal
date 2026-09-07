using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;

namespace Madrid.Api.Tests;

// Smoke tests contra un SQLite temporal con datos conocidos -- no necesitan SQL Server.
// Cubren el cálculo más fácil de romper sin darse cuenta: accuracy del modelo vs. el
// baseline "siempre gana el Real Madrid" (ver Program.cs, /api/dashboard/model-accuracy).
public class ModelAccuracyTests : IAsyncLifetime
{
    private string _dbPath = null!;
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public async Task InitializeAsync()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"madrid-test-{Guid.NewGuid():N}.db");
        await SeedDatabaseAsync(_dbPath);

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
        try { File.Delete(_dbPath); } catch { /* Windows a veces tarda en soltar el handle */ }
        return Task.CompletedTask;
    }

    // Real Madrid = TeamId 541 (mismo valor que RealMadridId en Program.cs -- no se
    // importa la constante porque es privada al top-level statement, así que se
    // documenta la duplicación aquí a propósito).
    private const int RealMadridId = 541;

    private static async Task SeedDatabaseAsync(string path)
    {
        using var conn = new SqliteConnection($"Data Source={path}");
        await conn.OpenAsync();
        var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE Teams (TeamId INTEGER PRIMARY KEY, Name TEXT);
            CREATE TABLE Fixtures (
                FixtureId INTEGER PRIMARY KEY, HomeTeamId INTEGER, AwayTeamId INTEGER,
                HomeGoals INTEGER, AwayGoals INTEGER, StatusShort TEXT, KickoffUtc TEXT,
                RoundLabel TEXT, CompetitionType TEXT, Season INTEGER
            );
            CREATE TABLE Predictions (
                PredictionId INTEGER PRIMARY KEY, FixtureId INTEGER, Market TEXT,
                ProbHome REAL, ProbDraw REAL, ProbAway REAL,
                ActualOutcome TEXT, WasCorrect INTEGER
            );
            CREATE TABLE PredictionModels (
                ModelId INTEGER PRIMARY KEY, Market TEXT, Algorithm TEXT, Version TEXT,
                ValAccuracy REAL, ValLogLoss REAL, ValBrier REAL, TrainedAtUtc TEXT, IsActive INTEGER
            );

            INSERT INTO Teams (TeamId, Name) VALUES (541, 'Real Madrid'), (1, 'Rival A'), (2, 'Rival B'), (3, 'Rival C');

            -- RM de local, gana 2-0 -- el modelo predijo bien (WasCorrect=1)
            INSERT INTO Fixtures (FixtureId, HomeTeamId, AwayTeamId, HomeGoals, AwayGoals, StatusShort, KickoffUtc, Season)
                VALUES (100, 541, 1, 2, 0, 'FT', '2024-01-01', 2024);
            INSERT INTO Predictions (FixtureId, Market, ActualOutcome, WasCorrect) VALUES (100, '1X2', 'H', 1);

            -- RM de visita, pierde 0-1 (gana el local, que no es RM) -- el modelo falló
            INSERT INTO Fixtures (FixtureId, HomeTeamId, AwayTeamId, HomeGoals, AwayGoals, StatusShort, KickoffUtc, Season)
                VALUES (101, 2, 541, 1, 0, 'FT', '2024-01-08', 2024);
            INSERT INTO Predictions (FixtureId, Market, ActualOutcome, WasCorrect) VALUES (101, '1X2', 'H', 0);

            -- RM de local, empata 1-1 -- el modelo acertó el empate
            INSERT INTO Fixtures (FixtureId, HomeTeamId, AwayTeamId, HomeGoals, AwayGoals, StatusShort, KickoffUtc, Season)
                VALUES (102, 541, 3, 1, 1, 'FT', '2024-01-15', 2024);
            INSERT INTO Predictions (FixtureId, Market, ActualOutcome, WasCorrect) VALUES (102, '1X2', 'D', 1);

            INSERT INTO PredictionModels (Market, Algorithm, Version, ValAccuracy, ValLogLoss, ValBrier, TrainedAtUtc, IsActive)
                VALUES ('1X2', 'Ensemble', 'v2.0', 0.676, 0.85, 0.19, '2024-01-01', 1);
            """;
        await cmd.ExecuteNonQueryAsync();
    }

    [Fact]
    public async Task Health_reports_ok_when_the_database_is_reachable()
    {
        var res = await _client.GetAsync("/api/health");
        res.EnsureSuccessStatusCode();

        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("ok", body.GetProperty("status").GetString());
        Assert.Equal("ok", body.GetProperty("db").GetString());
    }

    [Fact]
    public async Task ModelAccuracy_computes_overall_accuracy_from_seeded_predictions()
    {
        var res = await _client.GetAsync("/api/dashboard/model-accuracy");
        res.EnsureSuccessStatusCode();

        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        var overall = body.GetProperty("overall");
        Assert.Equal(3, overall.GetProperty("total").GetInt32());
        Assert.Equal(2, overall.GetProperty("correct").GetInt32());
    }

    [Fact]
    public async Task ModelAccuracy_favoriteBaseline_is_always_gana_el_real_madrid_not_gana_el_local()
    {
        // Si esto se rompe y vuelve a ser "gana el local", el fixture 101 (RM de visita,
        // gana el local que es el rival) contaría como acierto del baseline -- y no debería.
        var res = await _client.GetAsync("/api/dashboard/model-accuracy");
        res.EnsureSuccessStatusCode();

        var baseline = (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("favoriteBaseline");
        Assert.Equal(3, baseline.GetProperty("total").GetInt32());
        Assert.Equal(1, baseline.GetProperty("correct").GetInt32()); // solo el fixture 100 (RM local y gana)
    }

    [Fact]
    public async Task ModelAccuracy_exposes_the_active_model_calibration_metrics()
    {
        var res = await _client.GetAsync("/api/dashboard/model-accuracy");
        res.EnsureSuccessStatusCode();

        var activeModel = (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("activeModel");
        Assert.Equal("Ensemble", activeModel.GetProperty("algorithm").GetString());
        Assert.Equal(0.85, activeModel.GetProperty("valLogLoss").GetDouble(), precision: 3);
    }
}
