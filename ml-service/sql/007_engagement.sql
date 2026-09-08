USE MadridHagamosloReal;
GO

-- 4 tablas que, igual que en 006_match_data.sql, existían sin migración
-- trackeada (inferidas de desktop/madrid.db + api/Program.cs), más 2 tablas
-- nuevas para trackear valor de las apuestas sugeridas y vistas por episodio.

IF OBJECT_ID('dbo.UserPlayerRatings', 'U') IS NULL
CREATE TABLE dbo.UserPlayerRatings (
    FixtureId INT NOT NULL REFERENCES dbo.Fixtures(FixtureId),
    PlayerId INT NOT NULL,
    Rating DECIMAL(4,2) NOT NULL,
    Review NVARCHAR(500) NULL,
    RatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    PRIMARY KEY (FixtureId, PlayerId)
);
GO

IF OBJECT_ID('dbo.OddsSnapshots', 'U') IS NULL
CREATE TABLE dbo.OddsSnapshots (
    OddsSnapshotId INT IDENTITY PRIMARY KEY,
    FixtureId INT NOT NULL REFERENCES dbo.Fixtures(FixtureId),
    Bookmaker NVARCHAR(60) NOT NULL,
    OddHome DECIMAL(6,2) NOT NULL,
    OddDraw DECIMAL(6,2) NOT NULL,
    OddAway DECIMAL(6,2) NOT NULL,
    ImpliedHome DECIMAL(6,4) NOT NULL,
    ImpliedDraw DECIMAL(6,4) NOT NULL,
    ImpliedAway DECIMAL(6,4) NOT NULL,
    FetchedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
CREATE INDEX IX_OddsSnapshots_Fixture ON dbo.OddsSnapshots(FixtureId);
GO

IF OBJECT_ID('dbo.PodcastHistory', 'U') IS NULL
CREATE TABLE dbo.PodcastHistory (
    PodcastId INT IDENTITY PRIMARY KEY,
    FixtureId INT NOT NULL REFERENCES dbo.Fixtures(FixtureId),
    Title NVARCHAR(200) NOT NULL,
    EpisodeLabel NVARCHAR(100) NOT NULL,
    YoutubeLink NVARCHAR(300) NOT NULL,
    GeneratedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.GeneratedMedia', 'U') IS NULL
CREATE TABLE dbo.GeneratedMedia (
    MediaId INT IDENTITY PRIMARY KEY,
    Kind NVARCHAR(20) NOT NULL,            -- 'video' | 'image'
    FileName NVARCHAR(300) NOT NULL,
    FixtureId INT NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- Nueva: registro de cada "value bet" que se le mostró al usuario en
-- /prediccion, para poder medir después (una vez jugado el partido) si esa
-- divergencia modelo-vs-mercado de verdad valía la pena o era ruido. Se
-- sobreescribe por partido -- interesa el último cálculo antes del kickoff,
-- no un historial de cada vez que se recalculó con momios actualizados.
IF OBJECT_ID('dbo.ValueBetLog', 'U') IS NULL
CREATE TABLE dbo.ValueBetLog (
    FixtureId INT NOT NULL PRIMARY KEY REFERENCES dbo.Fixtures(FixtureId),
    Market NVARCHAR(30) NOT NULL,          -- 'Gana el Real Madrid' | 'Empate' | 'Gana el rival'
    RecommendedSide CHAR(1) NOT NULL,      -- 'H' | 'D' | 'A' -- para comparar contra Predictions.ActualOutcome
    ModelProb DECIMAL(6,4) NOT NULL,
    MarketProb DECIMAL(6,4) NOT NULL,
    EdgePct DECIMAL(6,2) NOT NULL,
    LoggedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- Nueva: vistas/engagement por episodio, cargadas a mano por el usuario (no
-- hay integración con YouTube Analytics). Varias filas por episodio permite
-- ver la curva (24h, 7 días, 30 días) en vez de un solo número congelado.
IF OBJECT_ID('dbo.EpisodeMetrics', 'U') IS NULL
CREATE TABLE dbo.EpisodeMetrics (
    EpisodeMetricId INT IDENTITY PRIMARY KEY,
    PodcastId INT NOT NULL REFERENCES dbo.PodcastHistory(PodcastId),
    ViewsCount INT NOT NULL,
    MeasuredAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
