USE MadridHagamosloReal;
GO

-- Bajas y dudas (lesión/sanción) reportadas por API-Football -- una fila por
-- (jugador, partido) en el que se marcó como ausente/dudoso para ESE partido puntual.
-- API-Football no expone un flag limpio de "todavía lesionado hoy": la API .NET
-- aproxima el estado actual mirando los registros más recientes cerca de la fecha
-- de hoy (ver /api/players/availability en api/Program.cs). Reason/Type llegan tal
-- cual los manda la API ("Muscle Injury", "Suspended", "Illness"...).
IF OBJECT_ID('dbo.PlayerAvailability', 'U') IS NULL
CREATE TABLE dbo.PlayerAvailability (
    PlayerId INT NOT NULL REFERENCES dbo.Players(PlayerId),
    FixtureId INT NOT NULL REFERENCES dbo.Fixtures(FixtureId),
    Type NVARCHAR(40) NULL,
    Reason NVARCHAR(120) NULL,
    IngestedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    PRIMARY KEY (PlayerId, FixtureId)
);
GO
