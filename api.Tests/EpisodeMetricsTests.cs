using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;

namespace Madrid.Api.Tests;

// POST /api/podcast/{id}/metrics + el LEFT JOIN en GET /api/podcast/history --
// cubre: la tabla se auto-crea si no existe (app instalada vieja), y el historial
// muestra la medición MÁS RECIENTE por episodio, no la primera ni un promedio.
public class EpisodeMetricsTests : IAsyncLifetime
{
    private string _dbPath = null!;
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public async Task InitializeAsync()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"madrid-episodemetrics-test-{Guid.NewGuid():N}.db");
        using (var conn = new SqliteConnection($"Data Source={_dbPath}"))
        {
            await conn.OpenAsync();
            var cmd = conn.CreateCommand();
            cmd.CommandText = """
                CREATE TABLE PodcastHistory (PodcastId INTEGER PRIMARY KEY, FixtureId INTEGER, Title TEXT,
                    EpisodeLabel TEXT, YoutubeLink TEXT, GeneratedAtUtc TEXT);
                INSERT INTO PodcastHistory (PodcastId, FixtureId, Title, EpisodeLabel, YoutubeLink, GeneratedAtUtc)
                    VALUES (1, 100, 'Título', 'Episodio 1', 'https://youtube.com/x', '2026-01-01T00:00:00Z');
                """;
            await cmd.ExecuteNonQueryAsync();
        }

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

    [Fact]
    public async Task History_has_no_views_before_any_metric_is_logged()
    {
        var res = await _client.GetAsync("/api/podcast/history");
        res.EnsureSuccessStatusCode();
        var items = (await res.Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray().ToList();
        Assert.Single(items);
        Assert.Equal(JsonValueKind.Null, items[0].GetProperty("latestViews").ValueKind);
    }

    [Fact]
    public async Task Logging_metrics_creates_the_table_and_history_reflects_the_latest_measurement()
    {
        var first = await _client.PostAsJsonAsync("/api/podcast/1/metrics", new { viewsCount = 100 });
        first.EnsureSuccessStatusCode();

        await Task.Delay(10); // asegura que MeasuredAtUtc difiera entre las dos mediciones
        var second = await _client.PostAsJsonAsync("/api/podcast/1/metrics", new { viewsCount = 250 });
        second.EnsureSuccessStatusCode();

        var res = await _client.GetAsync("/api/podcast/history");
        res.EnsureSuccessStatusCode();
        var items = (await res.Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray().ToList();

        Assert.Equal(250, items[0].GetProperty("latestViews").GetInt32());
    }

    [Fact]
    public async Task Rejects_negative_view_counts()
    {
        var res = await _client.PostAsJsonAsync("/api/podcast/1/metrics", new { viewsCount = -5 });
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, res.StatusCode);
    }
}
