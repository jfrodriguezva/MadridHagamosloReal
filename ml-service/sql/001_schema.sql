USE MadridHagamosloReal;
GO

IF OBJECT_ID('dbo.Teams', 'U') IS NULL
CREATE TABLE dbo.Teams (
    TeamId INT PRIMARY KEY,
    Name NVARCHAR(120) NOT NULL,
    Country NVARCHAR(80) NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.Leagues', 'U') IS NULL
CREATE TABLE dbo.Leagues (
    LeagueId INT PRIMARY KEY,
    Name NVARCHAR(120) NOT NULL,
    Country NVARCHAR(80) NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- Un registro por partido, cualquier equipo de la liga (no solo Real Madrid) --
-- se necesita el universo completo de la liga para calcular Elo/pi-ratings y --
-- entrenar el clasificador general con suficiente volumen de datos.          --
IF OBJECT_ID('dbo.Fixtures', 'U') IS NULL
CREATE TABLE dbo.Fixtures (
    FixtureId INT PRIMARY KEY,
    LeagueId INT NOT NULL REFERENCES dbo.Leagues(LeagueId),
    Season INT NOT NULL,
    RoundLabel NVARCHAR(60) NULL,
    KickoffUtc DATETIME2 NOT NULL,
    StatusShort NVARCHAR(10) NOT NULL,      -- FT, PST, CANC...
    HomeTeamId INT NOT NULL REFERENCES dbo.Teams(TeamId),
    AwayTeamId INT NOT NULL REFERENCES dbo.Teams(TeamId),
    HomeGoals INT NULL,
    AwayGoals INT NULL,
    HomeGoalsHT INT NULL,
    AwayGoalsHT INT NULL,
    VenueId INT NULL,
    RefereeName NVARCHAR(120) NULL,
    IngestedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
CREATE INDEX IX_Fixtures_League_Season ON dbo.Fixtures(LeagueId, Season);
GO
CREATE INDEX IX_Fixtures_HomeTeam ON dbo.Fixtures(HomeTeamId, KickoffUtc);
CREATE INDEX IX_Fixtures_AwayTeam ON dbo.Fixtures(AwayTeamId, KickoffUtc);
GO

-- Snapshot de features materializadas justo antes de cada predicción --
-- (una fila por fixture + versión de featureset), inmutable.         --
IF OBJECT_ID('dbo.PredictionFeatureSnapshots', 'U') IS NULL
CREATE TABLE dbo.PredictionFeatureSnapshots (
    SnapshotId BIGINT IDENTITY PRIMARY KEY,
    FixtureId INT NOT NULL REFERENCES dbo.Fixtures(FixtureId),
    FeaturesetVersion NVARCHAR(20) NOT NULL,
    FeaturesJson NVARCHAR(MAX) NOT NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- Un registro por modelo entrenado + mercado, con sus métricas reales --
-- de validación walk-forward (nunca sobreescritas).                   --
IF OBJECT_ID('dbo.PredictionModels', 'U') IS NULL
CREATE TABLE dbo.PredictionModels (
    ModelId INT IDENTITY PRIMARY KEY,
    Market NVARCHAR(30) NOT NULL,           -- 1X2, BTTS, OU25, MADRID_WIN...
    Algorithm NVARCHAR(60) NOT NULL,        -- XGBoost, LightGBM, Poisson...
    Version NVARCHAR(20) NOT NULL,
    TrainedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    TrainWindowStart DATE NOT NULL,
    TrainWindowEnd DATE NOT NULL,
    ValAccuracy DECIMAL(6,4) NULL,
    ValLogLoss DECIMAL(8,5) NULL,
    ValRps DECIMAL(8,5) NULL,
    ValBrier DECIMAL(8,5) NULL,
    HyperparamsJson NVARCHAR(MAX) NULL,
    ArtifactPath NVARCHAR(400) NULL,
    IsActive BIT NOT NULL DEFAULT 0
);
GO

IF OBJECT_ID('dbo.Predictions', 'U') IS NULL
CREATE TABLE dbo.Predictions (
    PredictionId BIGINT IDENTITY PRIMARY KEY,
    FixtureId INT NOT NULL REFERENCES dbo.Fixtures(FixtureId),
    ModelId INT NOT NULL REFERENCES dbo.PredictionModels(ModelId),
    Market NVARCHAR(30) NOT NULL,
    ProbHome DECIMAL(6,4) NULL,
    ProbDraw DECIMAL(6,4) NULL,
    ProbAway DECIMAL(6,4) NULL,
    ProbYes DECIMAL(6,4) NULL,              -- para mercados binarios (BTTS, O/U, Madrid gana)
    PredictedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ActualOutcome NVARCHAR(10) NULL,        -- se rellena post-partido: H/D/A o YES/NO
    WasCorrect BIT NULL
);
GO
CREATE INDEX IX_Predictions_Fixture ON dbo.Predictions(FixtureId);
GO
