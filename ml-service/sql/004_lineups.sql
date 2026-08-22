USE MadridHagamosloReal;
GO

IF OBJECT_ID('dbo.UserLineups', 'U') IS NULL
CREATE TABLE dbo.UserLineups (
    UserLineupId INT IDENTITY PRIMARY KEY,
    FixtureId INT NOT NULL REFERENCES dbo.Fixtures(FixtureId),
    Formation NVARCHAR(10) NOT NULL,   -- '4-3-3', '4-2-3-1', etc.
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.UserLineupPlayers', 'U') IS NULL
CREATE TABLE dbo.UserLineupPlayers (
    UserLineupId INT NOT NULL REFERENCES dbo.UserLineups(UserLineupId),
    PlayerId INT NOT NULL REFERENCES dbo.Players(PlayerId),
    SlotPosition NVARCHAR(10) NOT NULL,   -- 'GK','LB','CB1','CB2','RB','CDM','CM1','CM2','LW','ST','RW'...
    IsStarter BIT NOT NULL DEFAULT 1,
    PRIMARY KEY (UserLineupId, SlotPosition)
);
GO
