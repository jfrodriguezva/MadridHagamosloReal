using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using System.Net.Http.Headers;

namespace Madrid.Api.Tests;

// POST /api/media/transcribe -- spawnea un proceso Python real (ml-service/.venv), sin
// mocks. Hoy faster-whisper todavia no esta instalado en ese venv a proposito (es pesado,
// se documenta en RECOVERY.md como paso manual del usuario), asi que este test fija el
// comportamiento honesto actual: falla con un mensaje claro, no un 500 generico ni un
// timeout silencioso. Cuando alguien instale faster-whisper este test empieza a fallar --
// es la señal correcta de que hay que actualizarlo, no un bug.
public class TranscribeEndpointTests : IAsyncLifetime
{
    private string _dbPath = null!;
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public async Task InitializeAsync()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"madrid-transcribe-test-{Guid.NewGuid():N}.db");
        using (var conn = new SqliteConnection($"Data Source={_dbPath}"))
        {
            await conn.OpenAsync();
        }

        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("DB_PROVIDER", "sqlite");
            builder.UseSetting("SQLITE_PATH", _dbPath);
        });
        _client = _factory.CreateClient();
        _client.Timeout = TimeSpan.FromSeconds(60); // arranque de Python + import puede tardar
    }

    public Task DisposeAsync()
    {
        _client.Dispose();
        _factory.Dispose();
        try { File.Delete(_dbPath); } catch { }
        return Task.CompletedTask;
    }

    [Fact]
    public async Task Fails_clearly_when_faster_whisper_is_not_installed_yet()
    {
        using var content = new MultipartFormDataContent();
        var fakeAudioBytes = new byte[] { 0x00, 0x01, 0x02, 0x03 }; // el contenido no importa -- el import de faster-whisper falla antes de leerlo
        var fileContent = new ByteArrayContent(fakeAudioBytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("audio/wav");
        content.Add(fileContent, "audio", "clip.wav");

        var res = await _client.PostAsync("/api/media/transcribe", content);
        var body = await res.Content.ReadAsStringAsync();

        Assert.False(res.IsSuccessStatusCode);
        Assert.Contains("faster-whisper", body, StringComparison.OrdinalIgnoreCase);
    }
}
