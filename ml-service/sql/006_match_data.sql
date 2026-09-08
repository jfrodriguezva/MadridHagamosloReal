USE MadridHagamosloReal;
GO

-- Estas 6 tablas existían en la base de desarrollo original pero nunca quedaron
-- en un script de migración -- se agregan aquí recién ahora, con la definición
-- inferida del propio SQLite exportado (desktop/madrid.db) más el uso real en
-- api/Program.cs, para que "levantar el entorno en otro equipo" no dependa de
-- tener un .bak a mano.

IF OBJECT_ID('dbo.Coaches', 'U') IS NULL
CREATE TABLE dbo.Coaches (
    CoachId INT PRIMARY KEY,
    Name NVARCHAR(120) NOT NULL,
    Nationality NVARCHAR(80) NULL,
    PhotoUrl NVARCHAR(300) NULL
);
GO

IF OBJECT_ID('dbo.CoachCareer', 'U') IS NULL
CREATE TABLE dbo.CoachCareer (
    CoachId INT NOT NULL REFERENCES dbo.Coaches(CoachId),
    TeamId INT NOT NULL REFERENCES dbo.Teams(TeamId),
    StartDate DATE NOT NULL,
    EndDate DATE NULL,
    TeamName NVARCHAR(120) NULL,
    PRIMARY KEY (CoachId, TeamId, StartDate)
);
GO

IF OBJECT_ID('dbo.MatchLineups', 'U') IS NULL
CREATE TABLE dbo.MatchLineups (
    FixtureId INT NOT NULL REFERENCES dbo.Fixtures(FixtureId),
    TeamId INT NOT NULL REFERENCES dbo.Teams(TeamId),
    CoachName NVARCHAR(120) NULL,
    Formation NVARCHAR(20) NULL,
    PRIMARY KEY (FixtureId, TeamId)
);
GO

IF OBJECT_ID('dbo.MatchLineupPlayers', 'U') IS NULL
CREATE TABLE dbo.MatchLineupPlayers (
    FixtureId INT NOT NULL,
    TeamId INT NOT NULL,
    PlayerId INT NOT NULL,
    PlayerName NVARCHAR(120) NULL,
    ShirtNumber INT NULL,
    PosCode NVARCHAR(10) NULL,
    GridSlot NVARCHAR(10) NULL,
    IsStarter BIT NOT NULL DEFAULT 0,
    PRIMARY KEY (FixtureId, TeamId, PlayerId),
    FOREIGN KEY (FixtureId, TeamId) REFERENCES dbo.MatchLineups(FixtureId, TeamId)
);
GO

IF OBJECT_ID('dbo.MatchEvents2', 'U') IS NULL
CREATE TABLE dbo.MatchEvents2 (
    EventId INT IDENTITY PRIMARY KEY,
    FixtureId INT NOT NULL REFERENCES dbo.Fixtures(FixtureId),
    TeamId INT NOT NULL,
    Minute INT NOT NULL,
    ExtraMinute INT NULL,
    PlayerId INT NULL,
    PlayerName NVARCHAR(120) NULL,
    AssistPlayerId INT NULL,
    AssistPlayerName NVARCHAR(120) NULL,
    EventType NVARCHAR(30) NOT NULL,       -- 'Goal', 'Card', 'subst'...
    EventDetail NVARCHAR(60) NULL
);
GO
CREATE INDEX IX_MatchEvents2_Fixture ON dbo.MatchEvents2(FixtureId);
GO

IF OBJECT_ID('dbo.MatchPlayerRatings', 'U') IS NULL
CREATE TABLE dbo.MatchPlayerRatings (
    FixtureId INT NOT NULL REFERENCES dbo.Fixtures(FixtureId),
    PlayerId INT NOT NULL,
    AiRating DECIMAL(4,2) NOT NULL,
    Minutes INT NULL,
    PRIMARY KEY (FixtureId, PlayerId)
);
GO
