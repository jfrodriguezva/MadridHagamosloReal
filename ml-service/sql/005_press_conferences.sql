USE MadridHagamosloReal;
GO

-- Ruedas de prensa previas al próximo partido. No vienen de API-Football
-- (no las expone) -- se llenan por dos vías que conviven en la misma tabla,
-- distinguidas por Source: 'buscador' (fetch_presser.py, citas textuales
-- extraídas de notas de prensa reales, con su link) y 'claude'/'manual'
-- (temas ya sintetizados que se cargan a mano vía POST /api/press/manual).
IF OBJECT_ID('dbo.PressConferences', 'U') IS NULL
CREATE TABLE dbo.PressConferences (
    PressConferenceId INT IDENTITY PRIMARY KEY,
    FixtureId INT NOT NULL REFERENCES dbo.Fixtures(FixtureId),
    CoachName NVARCHAR(120) NOT NULL,
    Source NVARCHAR(20) NOT NULL,          -- 'buscador' | 'claude' | 'manual'
    SourceName NVARCHAR(160) NULL,         -- medio que publicó la nota
    SourceUrl NVARCHAR(500) NULL,
    Headline NVARCHAR(400) NULL,           -- titular real de la nota (no inventado)
    PublishedAtUtc DATETIME2 NULL,
    FetchedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- Un tema del episodio. Para Source='buscador', Quote es la cita textual tal
-- cual apareció publicada y Topic queda vacío hasta que el usuario lo titule
-- -- la app nunca inventa el tema a partir del texto.
IF OBJECT_ID('dbo.PressTopics', 'U') IS NULL
CREATE TABLE dbo.PressTopics (
    PressTopicId INT IDENTITY PRIMARY KEY,
    PressConferenceId INT NOT NULL REFERENCES dbo.PressConferences(PressConferenceId),
    Topic NVARCHAR(300) NULL,
    Quote NVARCHAR(MAX) NULL,
    Angle NVARCHAR(MAX) NULL,              -- el ángulo del usuario para el guion
    Selected BIT NOT NULL DEFAULT 0,       -- marcado para entrar al guion del episodio
    SortOrder INT NOT NULL DEFAULT 0
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PressConferences_Fixture')
CREATE INDEX IX_PressConferences_Fixture ON dbo.PressConferences(FixtureId);
GO
