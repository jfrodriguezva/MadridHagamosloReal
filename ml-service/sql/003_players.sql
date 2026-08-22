USE MadridHagamosloReal;
GO

IF OBJECT_ID('dbo.Players', 'U') IS NULL
CREATE TABLE dbo.Players (
    PlayerId INT PRIMARY KEY,
    TeamId INT NOT NULL REFERENCES dbo.Teams(TeamId),
    Name NVARCHAR(120) NOT NULL,
    Age INT NULL,
    Nationality NVARCHAR(80) NULL,
    HeightCm INT NULL,
    WeightKg INT NULL,
    PhotoUrl NVARCHAR(300) NULL,
    Position NVARCHAR(30) NULL,      -- Goalkeeper/Defender/Midfielder/Attacker (posición genérica de API-Football)
    ShirtNumber INT NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.PlayerSeasonStats', 'U') IS NULL
CREATE TABLE dbo.PlayerSeasonStats (
    PlayerId INT NOT NULL REFERENCES dbo.Players(PlayerId),
    Season INT NOT NULL,
    Appearances INT NULL, Minutes INT NULL,
    Goals INT NULL, Assists INT NULL,
    ShotsTotal INT NULL, ShotsOn INT NULL,
    PassesTotal INT NULL, PassesAccuracyPct DECIMAL(5,2) NULL, KeyPasses INT NULL,
    TacklesTotal INT NULL, Interceptions INT NULL,
    DuelsTotal INT NULL, DuelsWon INT NULL,
    DribblesAttempts INT NULL, DribblesSuccess INT NULL,
    FoulsCommitted INT NULL, YellowCards INT NULL, RedCards INT NULL,
    RatingAvg DECIMAL(4,2) NULL,
    IngestedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    PRIMARY KEY (PlayerId, Season)
);
GO

IF OBJECT_ID('dbo.PlayerAttributes', 'U') IS NULL
CREATE TABLE dbo.PlayerAttributes (
    PlayerId INT NOT NULL REFERENCES dbo.Players(PlayerId),
    Season INT NOT NULL,
    Overall INT NULL, Potential INT NULL,
    Pace INT NULL, Shooting INT NULL, Passing INT NULL,
    Dribbling INT NULL, Defending INT NULL, Physical INT NULL,
    CalculatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    PRIMARY KEY (PlayerId, Season)
);
GO
