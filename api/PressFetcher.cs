using System.Data;
using System.Net;
using System.Text.RegularExpressions;
using Dapper;

/// <summary>
/// Trae la rueda de prensa previa al próximo partido y guarda las CITAS
/// TEXTUALES tal como las publicaron, con su medio y su link.
///
/// Vive en la API (y no en un script de Python como la carga histórica) por dos
/// razones: no necesita cuota de API-Football ni credenciales, y así el botón
/// funciona igual en desarrollo y en la app instalada, sin depender de que haya
/// un intérprete de Python en la máquina.
///
/// Nunca resume ni interpreta: extrae lo que ya venía entrecomillado y deja que
/// el usuario titule el tema y elija qué entra al episodio.
/// </summary>
public static class PressFetcher
{
    private const string UserAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

    // Sala de prensa oficial del club: es la transcripción de primera mano, sin
    // el ruido de una nota de prensa reescrita. Se consulta primero.
    private const string OfficialIndex = "https://www.realmadrid.com/es-ES/noticias/futbol/primer-equipo/ruedas-de-prensa";

    private const int MaxArticles = 6;
    private const int MaxQuotesPerArticle = 10;

    // Un patrón por tipo de comilla, nunca mezclados: si se permite abrir con “
    // y cerrar con ", el apóstrofo tipográfico de cualquier palabra empareja con
    // la comilla siguiente y captura un pedazo de párrafo que no es una cita.
    private static readonly Regex[] QuotePatterns =
    [
        new("\u201C\\s*([^\u201D]{35,480}?)\\s*\u201D", RegexOptions.Compiled),
        new("\u00AB\\s*([^\u00BB]{35,480}?)\\s*\u00BB", RegexOptions.Compiled),
        new("\"\\s*([^\"]{35,480}?)\\s*\"", RegexOptions.Compiled),
    ];

    // Una cita empieza como empieza una frase dicha en voz alta; arrancar con
    // punto, coma o minúscula delata que el patrón partió un párrafo por la mitad.
    private static readonly Regex QuoteStart = new("^[¿¡A-ZÁÉÍÓÚÜÑ]", RegexOptions.Compiled);
    // Nadie habla en mayúsculas sostenidas: más de una palabra así delata un menú.
    private static readonly Regex CapsWord = new("\\b[A-ZÁÉÍÓÚÜÑ]{3,}\\b", RegexOptions.Compiled);
    private static readonly Regex ParagraphTag = new("<p[^>]*>(.*?)</p>", RegexOptions.Singleline | RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex ScriptTag = new("<(script|style)[^>]*>.*?</\\1>", RegexOptions.Singleline | RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex AnyTag = new("<[^>]+>", RegexOptions.Compiled);
    private static readonly Regex Whitespace = new("\\s+", RegexOptions.Compiled);
    private static readonly Regex HrefAttr = new("href=\"([^\"]+)\"", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex RssItem = new("<item>(.*?)</item>", RegexOptions.Singleline | RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly string[] NavChars = ["\u2192", "\u203A", "|"];

    public static async Task RunAsync(Func<IDbConnection> factory, bool isSqlite, int realMadridId, Action<string> log)
    {
        using var conn = factory();
        string top1 = isSqlite ? "" : "TOP (1)";
        string limit1 = isSqlite ? "LIMIT 1" : "";

        var fixture = await conn.QuerySingleOrDefaultAsync<dynamic>(
            $"""
            SELECT {top1} f.FixtureId AS fixtureId, f.KickoffUtc AS kickoffUtc,
                   CASE WHEN f.HomeTeamId=@rm THEN at.Name ELSE ht.Name END AS rival
            FROM Fixtures f JOIN Teams ht ON f.HomeTeamId=ht.TeamId JOIN Teams at ON f.AwayTeamId=at.TeamId
            WHERE (f.HomeTeamId=@rm OR f.AwayTeamId=@rm) AND f.StatusShort='NS'
            ORDER BY f.KickoffUtc ASC
            {limit1}
            """, new { rm = realMadridId });

        if (fixture is null)
        {
            log("No hay próximo partido sin jugar en la base. Nada que buscar.");
            return;
        }

        int fixtureId = (int)fixture.fixtureId;
        string rival = (string)fixture.rival;
        string coach = await conn.QuerySingleOrDefaultAsync<string>(
            $"""
            SELECT {top1} co.Name FROM CoachCareer cc JOIN Coaches co ON cc.CoachId = co.CoachId
            WHERE cc.TeamId = @rm ORDER BY cc.StartDate DESC
            {limit1}
            """, new { rm = realMadridId }) ?? "el entrenador del Real Madrid";

        log($"Próximo partido: Real Madrid vs {rival} ({fixture.kickoffUtc}).");
        log($"Buscando la rueda de prensa previa de {coach}…");

        using var http = new HttpClient(new HttpClientHandler { AutomaticDecompression = DecompressionMethods.All })
        {
            Timeout = TimeSpan.FromSeconds(20),
        };
        http.DefaultRequestHeaders.Add("User-Agent", UserAgent);

        var candidates = new List<(string Url, string? Headline)>();
        candidates.AddRange(await OfficialPressers(http, coach, log));
        candidates.AddRange(await NewsSearchResults(http, coach, rival, log));

        string surname = Surname(coach);
        int storedConfs = 0, storedQuotes = 0;
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var (url, headline) in candidates)
        {
            if (storedConfs >= MaxArticles) break;
            if (!seen.Add(url)) continue;

            bool already = await conn.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM PressConferences WHERE FixtureId=@id AND SourceUrl=@url",
                new { id = fixtureId, url }) > 0;
            if (already)
            {
                log($"  · ya guardada: {Short(headline ?? url)}");
                continue;
            }

            var (html, finalUrl) = await TryGetWithFinalUrl(http, url);
            if (html is null)
            {
                log($"  · no se pudo abrir: {Short(headline ?? url)}");
                continue;
            }

            string text = PlainText(html);
            if (!text.Contains(surname, StringComparison.OrdinalIgnoreCase)
                && !(headline ?? "").Contains(surname, StringComparison.OrdinalIgnoreCase))
            {
                log($"  · no menciona a {surname}: {Short(headline ?? url)}");
                continue;
            }

            var quotes = ExtractQuotes(text);
            if (quotes.Count == 0)
            {
                log($"  · sin citas textuales: {Short(headline ?? url)}");
                continue;
            }

            string publisher = new Uri(finalUrl).Host.Replace("www.", "");
            bool oficial = publisher.Contains("realmadrid.com", StringComparison.OrdinalIgnoreCase);
            string title = headline ?? PageTitle(html) ?? finalUrl;

            int confId = await InsertConference(conn, isSqlite, fixtureId, coach,
                oficial ? "oficial" : "buscador", publisher, finalUrl, title);
            for (int i = 0; i < quotes.Count; i++)
            {
                await conn.ExecuteAsync(
                    """
                    INSERT INTO PressTopics (PressConferenceId, Topic, Quote, Angle, Selected, SortOrder)
                    VALUES (@confId, NULL, @quote, NULL, @selected, @order)
                    """,
                    new { confId, quote = quotes[i], selected = false, order = i });
            }

            storedConfs++;
            storedQuotes += quotes.Count;
            log($"  + {quotes.Count} citas de {publisher}{(oficial ? " (fuente oficial)" : "")}: {Short(title)}");
        }

        if (storedConfs == 0)
            log("No se guardó nada nuevo. Puedes cargar los temas a mano, o pedirle a Claude que investigue la rueda y la escriba por ti.");
        else
            log($"Listo: {storedQuotes} citas nuevas de {storedConfs} fuentes. Titula los temas y marca los que entran al episodio.");
    }

    /// <summary>Enlaces de la sala de prensa oficial del club, los más recientes primero.</summary>
    private static async Task<List<(string, string?)>> OfficialPressers(HttpClient http, string coach, Action<string> log)
    {
        var found = new List<(string, string?)>();
        string? html = await TryGet(http, OfficialIndex);
        if (html is null)
        {
            log("  · la sala de prensa oficial no respondió, se sigue con buscadores");
            return found;
        }

        string surname = Surname(coach).ToLowerInvariant();
        foreach (Match m in HrefAttr.Matches(html))
        {
            string href = m.Groups[1].Value;
            if (!href.Contains("/ruedas-de-prensa/", StringComparison.OrdinalIgnoreCase)) continue;
            // el slug del club es {apellido}-{dd-MM-yyyy}; nos quedamos con los del técnico actual
            if (!href.Contains(surname, StringComparison.OrdinalIgnoreCase)) continue;

            string url = href.StartsWith("http") ? href : "https://www.realmadrid.com" + href;
            found.Add((url, null));
            if (found.Count >= 3) break;
        }

        log($"  sala de prensa oficial: {found.Count} comparecencias de {Surname(coach)}");
        return found;
    }

    /// <summary>Notas de prensa de medios, vía el RSS de noticias de Bing (sin API key).</summary>
    private static async Task<List<(string, string?)>> NewsSearchResults(HttpClient http, string coach, string rival, Action<string> log)
    {
        var found = new List<(string, string?)>();
        string query = Uri.EscapeDataString($"\"{coach}\" rueda de prensa {rival} Real Madrid");
        string? xml = await TryGet(http, $"https://www.bing.com/news/search?q={query}&format=RSS&setlang=es");
        if (xml is null) return found;

        foreach (Match item in RssItem.Matches(xml))
        {
            string block = item.Groups[1].Value;
            string? link = TagValue(block, "link");
            string? title = TagValue(block, "title");
            if (link is null || title is null) continue;
            found.Add((link, title));
            if (found.Count >= 8) break;
        }

        log($"  buscadores: {found.Count} notas encontradas");
        return found;
    }

    private static async Task<int> InsertConference(IDbConnection conn, bool isSqlite, int fixtureId,
        string coach, string source, string publisher, string url, string headline)
    {
        var p = new
        {
            fixtureId,
            coachName = coach,
            source,
            sourceName = publisher,
            sourceUrl = url,
            headline = headline.Length > 380 ? headline[..380] : headline,
            fetchedAtUtc = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"),
        };

        const string columns = "(FixtureId, CoachName, Source, SourceName, SourceUrl, Headline, FetchedAtUtc)";
        const string values = "(@fixtureId, @coachName, @source, @sourceName, @sourceUrl, @headline, @fetchedAtUtc)";

        return isSqlite
            ? await conn.QuerySingleAsync<int>($"INSERT INTO PressConferences {columns} VALUES {values}; SELECT last_insert_rowid();", p)
            : await conn.QuerySingleAsync<int>($"INSERT INTO PressConferences {columns} OUTPUT INSERTED.PressConferenceId VALUES {values}", p);
    }

    private static async Task<string?> TryGet(HttpClient http, string url)
        => (await TryGetWithFinalUrl(http, url)).Html;

    /// <summary>
    /// Devuelve también la URL final: los enlaces del RSS de Bing apuntan a
    /// bing.com y solo tras seguir las redirecciones se sabe qué medio publicó
    /// la nota. Sin esto, todas las fuentes quedarían atribuidas al buscador.
    /// </summary>
    private static async Task<(string? Html, string FinalUrl)> TryGetWithFinalUrl(HttpClient http, string url)
    {
        try
        {
            using var resp = await http.GetAsync(url);
            if (!resp.IsSuccessStatusCode) return (null, url);
            string finalUrl = resp.RequestMessage?.RequestUri?.ToString() ?? url;
            return (await resp.Content.ReadAsStringAsync(), finalUrl);
        }
        catch
        {
            return (null, url);
        }
    }

    private static string PlainText(string html)
    {
        string raw = ScriptTag.Replace(html, " ");
        var parts = ParagraphTag.Matches(raw).Select(m => WebUtility.HtmlDecode(AnyTag.Replace(m.Groups[1].Value, " ")));
        return Whitespace.Replace(string.Join(" ", parts), " ").Trim();
    }

    private static string? PageTitle(string html)
    {
        var m = Regex.Match(html, "<title[^>]*>(.*?)</title>", RegexOptions.Singleline | RegexOptions.IgnoreCase);
        return m.Success ? WebUtility.HtmlDecode(AnyTag.Replace(m.Groups[1].Value, "")).Trim() : null;
    }

    private static string? TagValue(string block, string tag)
    {
        var m = Regex.Match(block, $"<{tag}[^>]*>(.*?)</{tag}>", RegexOptions.Singleline | RegexOptions.IgnoreCase);
        if (!m.Success) return null;
        string text = m.Groups[1].Value;
        var cdata = Regex.Match(text, "^\\s*<!\\[CDATA\\[(.*?)\\]\\]>\\s*$", RegexOptions.Singleline);
        if (cdata.Success) text = cdata.Groups[1].Value;
        text = WebUtility.HtmlDecode(AnyTag.Replace(text, "")).Trim();
        return text.Length == 0 ? null : text;
    }

    private static List<string> ExtractQuotes(string text)
    {
        var found = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var pattern in QuotePatterns)
        {
            foreach (Match m in pattern.Matches(text))
            {
                string quote = Whitespace.Replace(m.Groups[1].Value, " ").Trim();
                string key = quote.Length > 90 ? quote[..90] : quote;
                if (!seen.Add(key)) continue;
                if (!QuoteStart.IsMatch(quote)) continue;
                if (quote.Count(c => c == ',') > 14) continue;
                if (!quote.Any(char.IsLower)) continue;
                if (CapsWord.Matches(quote).Count > 1) continue;
                if (NavChars.Any(quote.Contains)) continue;

                found.Add(quote);
                if (found.Count >= MaxQuotesPerArticle) return found;
            }
        }
        return found;
    }

    private static string Surname(string fullName)
    {
        var parts = fullName.Replace(".", " ").Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(p => p.Length > 2).ToList();
        return parts.Count > 0 ? parts[^1] : fullName;
    }

    private static string Short(string s) => s.Length > 70 ? s[..70] : s;
}
