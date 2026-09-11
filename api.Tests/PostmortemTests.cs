using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;

namespace Madrid.Api.Tests;

// GET /api/matches/postmortem/last-match -- junta predicción vs resultado, value bet,
// MVP y calificaciones del último partido jugado. Cubre el caso donde todo existe (para
// que el join no pierda filas) y confirma que wasCorrect/avgUserVsAiDelta salen bien
// calculados, no solo que el endpoint responde 200.
public class PostmortemTests : IAsyncLifetime
{
    private const int RealMadridId = 541;
    private string _dbPath = null!;
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public async Task InitializeAsync()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"madrid-postmortem-test-{Guid.NewGuid():N}.db");
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
            CREATE TABLE Leagues (LeagueId INTEGER PRIMARY KEY, Name TEXT);
            CREATE TABLE Fixtures (FixtureId INTEGER PRIMARY KEY, HomeTeamId INTEGER, AwayTeamId INTEGER,
                HomeGoals INTEGER, AwayGoals INTEGER, StatusShort TEXT, KickoffUtc TEXT, RoundLabel TEXT,
                CompetitionType TEXT, LeagueId INTEGER);
            CREATE TABLE Predictions (PredictionId INTEGER PRIMARY KEY, FixtureId INTEGER, Market TEXT,
                ProbHome REAL, ProbDraw REAL, ProbAway REAL, BestScoreHome INTEGER, BestScoreAway INTEGER,
                BestScoreProb REAL, ActualOutcome TEXT, WasCorrect INTEGER);
            CREATE TABLE ValueBetLog (FixtureId INTEGER PRIMARY KEY, Market TEXT, RecommendedSide TEXT,
                ModelProb REAL, MarketProb REAL, EdgePct REAL, LoggedAtUtc TEXT);
            CREATE TABLE Players (PlayerId INTEGER PRIMARY KEY, Name TEXT, IsCurrentSquad INTEGER);
            CREATE TABLE MatchLineupPlayers (FixtureId INTEGER, TeamId INTEGER, PlayerId INTEGER,
                PlayerName TEXT, ShirtNumber INTEGER, PosCode TEXT, GridSlot TEXT, IsStarter INTEGER);
            CREATE TABLE MatchPlayerRatings (FixtureId INTEGER, PlayerId INTEGER, AiRating REAL, Minutes INTEGER);
            CREATE TABLE UserPlayerRatings (FixtureId INTEGER, PlayerId INTEGER, Rating REAL, Review TEXT, RatedAtUtc TEXT);

            INSERT INTO Teams (TeamId, Name) VALUES ({RealMadridId}, 'Real Madrid'), (1, 'Rival FC');
            INSERT INTO Leagues (LeagueId, Name) VALUES (1, 'LaLiga');

            -- Real Madrid de local, ganó 3-1; el modelo lo daba favorito y acertó.
            INSERT INTO Fixtures (FixtureId, HomeTeamId, AwayTeamId, HomeGoals, AwayGoals, StatusShort,
                KickoffUtc, RoundLabel, CompetitionType, LeagueId)
                VALUES (300, {RealMadridId}, 1, 3, 1, 'FT', '2026-02-01T20:00:00Z', 'Jornada 20', 'LEAGUE', 1);
            INSERT INTO Predictions (FixtureId, Market, ProbHome, ProbDraw, ProbAway, BestScoreHome, BestScoreAway,
                BestScoreProb, ActualOutcome, WasCorrect)
                VALUES (300, '1X2', 0.65, 0.20, 0.15, 2, 1, 0.18, 'H', 1);
            INSERT INTO ValueBetLog (FixtureId, Market, RecommendedSide, ModelProb, MarketProb, EdgePct)
                VALUES (300, 'Gana el Real Madrid', 'H', 0.65, 0.50, 15.0);

            INSERT INTO Players (PlayerId, Name, IsCurrentSquad) VALUES (1, 'Jugador Estrella', 1), (2, 'Jugador Discreto', 1);
            INSERT INTO MatchLineupPlayers (FixtureId, TeamId, PlayerId, PlayerName, ShirtNumber, PosCode, GridSlot, IsStarter)
                VALUES (300, {RealMadridId}, 1, 'Jugador Estrella', 9, 'DC', 'FWD', 1);
            INSERT INTO MatchLineupPlayers (FixtureId, TeamId, PlayerId, PlayerName, ShirtNumber, PosCode, GridSlot, IsStarter)
                VALUES (300, {RealMadridId}, 2, 'Jugador Discreto', 5, 'MC', 'MID', 1);
            INSERT INTO MatchPlayerRatings (FixtureId, PlayerId, AiRating, Minutes) VALUES (300, 1, 9.0, 90);
            INSERT INTO MatchPlayerRatings (FixtureId, PlayerId, AiRating, Minutes) VALUES (300, 2, 6.0, 90);
            -- el usuario calificó más duro al MVP de la IA (7.0 vs 9.0 = delta -2.0), y no
            -- calificó al segundo jugador -- ese jugador no debe contar en el promedio.
            INSERT INTO UserPlayerRatings (FixtureId, PlayerId, Rating, Review, RatedAtUtc)
                VALUES (300, 1, 7.0, 'Bien pero no tanto', '2026-02-01T22:00:00Z');
            """;
        await cmd.ExecuteNonQueryAsync();
    }

    [Fact]
    public async Task Postmortem_joins_prediction_valuebet_mvp_and_rating_delta_for_the_last_played_match()
    {
        var res = await _client.GetAsync("/api/matches/postmortem/last-match");
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(300, body.GetProperty("match").GetProperty("fixtureId").GetInt32());

        var prediction = body.GetProperty("prediction");
        Assert.Equal("H", prediction.GetProperty("actualOutcome").GetString());
        Assert.Equal(1, prediction.GetProperty("wasCorrect").GetInt32());

        var valueBet = body.GetProperty("valueBet");
        Assert.Equal("Gana el Real Madrid", valueBet.GetProperty("market").GetString());
        Assert.True(valueBet.GetProperty("wasCorrect").GetInt32() == 1);

        Assert.Equal("Jugador Estrella", body.GetProperty("mvp").GetProperty("name").GetString());
        Assert.Equal("Jugador Discreto", body.GetProperty("worst").GetProperty("name").GetString());

        var summary = body.GetProperty("ratingsSummary");
        Assert.Equal(1, summary.GetProperty("ratedCount").GetInt32());
        Assert.Equal(-2.0, summary.GetProperty("avgUserVsAiDelta").GetDouble(), precision: 3);
    }
}
