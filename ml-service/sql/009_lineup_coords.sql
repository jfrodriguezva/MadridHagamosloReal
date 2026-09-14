USE MadridHagamosloReal;
GO

-- El tablero de tactica (web/app/tactica) ya calcula X/Y libres (0-100) al
-- arrastrar jugadores, pero solo vivian en el estado de React -- al guardar
-- se perdian, y recargar la pagina dejaba el tablero vacio otra vez aunque
-- ya hubiera una alineacion guardada. Se agregan como columnas nuevas (no se
-- toca SlotPosition, que sigue siendo el orden de guardado) para poder
-- reconstruir el acomodo exacto del campo al recargar.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.UserLineupPlayers') AND name = 'X')
ALTER TABLE dbo.UserLineupPlayers ADD X FLOAT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.UserLineupPlayers') AND name = 'Y')
ALTER TABLE dbo.UserLineupPlayers ADD Y FLOAT NULL;
GO
