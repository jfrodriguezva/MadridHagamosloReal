using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;

namespace Madrid.Api.Tests;

// GET /api/players/availability -- aproxima "quién está afuera ahora" quedándose
// con el registro más reciente por jugador dentro de una ventana de fechas
// (ver el comentario en Program.cs). Cubre: la ventana descarta lo viejo, se
// queda con el registro más reciente cuando hay más de uno por jugador, y no
// truena si la tabla PlayerAvailability todavía no existe (app instalada vieja).
public class PlayerAvailabilityTests : IAsyncLifetime
{
    private const int RealMadridId = 541;
    private string _dbPath = null!;
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public async Task InitializeAsync()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"madrid-avail-test-{Guid.NewGuid():N}.db");
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
        // KickoffUtc como TEXT ISO8601, igual que produce export_to_sqlite.py en la app real.
        cmd.CommandText = $"""
            CREATE TABLE Players (PlayerId INTEGER PRIMARY KEY, TeamId INTEGER, Name TEXT);
            CREATE TABLE Fixtures (FixtureId INTEGER PRIMARY KEY, KickoffUtc TEXT);
            CREATE TABLE PlayerAvailability (
                PlayerId INTEGER NOT NULL, FixtureId INTEGER NOT NULL, Type TEXT, Reason TEXT, IngestedAtUtc TEXT,
                PRIMARY KEY (PlayerId, FixtureId)
            );

            INSERT INTO Players (PlayerId, TeamId, Name) VALUES
                (1, {RealMadridId}, 'Jugador Lesionado'),
                (2, {RealMadridId}, 'Jugador Al Dia'),
                (3, 99, 'Jugador De Otro Equipo');

            -- fixture reciente (hace 3 dias) y otro viejo (hace 60 dias) para el mismo jugador 1
            INSERT INTO Fixtures (FixtureId, KickoffUtc) VALUES
                (100, '{DateTime.UtcNow.AddDays(-3):yyyy-MM-ddTHH:mm:ssZ}'),
                (101, '{DateTime.UtcNow.AddDays(-60):yyyy-MM-ddTHH:mm:ssZ}'),
                (102, '{DateTime.UtcNow.AddDays(-3):yyyy-MM-ddTHH:mm:ssZ}');

            -- jugador 1: dos registros, el mas reciente (fixture 100) debe ganar sobre el viejo (101)
            INSERT INTO PlayerAvailability (PlayerId, FixtureId, Type, Reason) VALUES
                (1, 101, 'Missing Fixture', 'Reason Vieja'),
                (1, 100, 'Missing Fixture', 'Muscle Injury');

            -- jugador 3 no es del Real Madrid -- no debe aparecer aunque este en la ventana
            INSERT INTO PlayerAvailability (PlayerId, FixtureId, Type, Reason) VALUES
                (3, 102, 'Missing Fixture', 'Suspended');
            """;
        await cmd.ExecuteNonQueryAsync();
    }

    [Fact]
    public async Task Returns_only_the_most_recent_record_within_the_window_for_real_madrid_players()
    {
        var res = await _client.GetAsync("/api/players/availability");
        res.EnsureSuccessStatusCode();

        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        var items = body.EnumerateArray().ToList();

        Assert.Single(items); // solo el jugador 1 (RM, dentro de la ventana) -- jugador 3 es de otro equipo
        Assert.Equal(1, items[0].GetProperty("playerId").GetInt32());
        Assert.Equal("Muscle Injury", items[0].GetProperty("reason").GetString()); // el mas reciente, no el viejo
    }

    [Fact]
    public async Task Returns_empty_array_when_the_table_does_not_exist_yet()
    {
        var dbPath = Path.Combine(Path.GetTempPath(), $"madrid-avail-notable-{Guid.NewGuid():N}.db");
        using (var conn = new SqliteConnection($"Data Source={dbPath}"))
        {
            await conn.OpenAsync();
            var cmd = conn.CreateCommand();
            cmd.CommandText = "CREATE TABLE Players (PlayerId INTEGER PRIMARY KEY, TeamId INTEGER, Name TEXT); CREATE TABLE Fixtures (FixtureId INTEGER PRIMARY KEY, KickoffUtc TEXT);";
            await cmd.ExecuteNonQueryAsync();
        }

        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("DB_PROVIDER", "sqlite");
            builder.UseSetting("SQLITE_PATH", dbPath);
        });
        using var client = factory.CreateClient();

        var res = await client.GetAsync("/api/players/availability");
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Empty(body.EnumerateArray());

        try { File.Delete(dbPath); } catch { }
    }
}
