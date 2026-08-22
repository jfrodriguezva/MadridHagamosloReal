USE MadridHagamosloReal;
GO

IF OBJECT_ID('dbo.FixtureStatistics', 'U') IS NULL
CREATE TABLE dbo.FixtureStatistics (
    FixtureId INT NOT NULL REFERENCES dbo.Fixtures(FixtureId),
    TeamId INT NOT NULL REFERENCES dbo.Teams(TeamId),
    ShotsOnGoal INT NULL,
    TotalShots INT NULL,
    BallPossessionPct DECIMAL(5,2) NULL,
    Corners INT NULL,
    Fouls INT NULL,
    YellowCards INT NULL,
    RedCards INT NULL,
    IngestedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    PRIMARY KEY (FixtureId, TeamId)
);
GO
