USE MadridHagamosloReal;
GO

-- Columnas que existían en la base de desarrollo original (confirmado contra
-- desktop/madrid.db, que se exportó desde ahí) pero que 001_schema.sql y
-- 003_players.sql nunca capturaron -- se detectó al correr por primera vez
-- seed_dev_db_from_sqlite.py contra una base recién creada con
-- bootstrap-dev-db.ps1: la API ya las usa (api/Program.cs), solo faltaban
-- en la migración. IF NOT EXISTS porque 001/003 pueden haber creado la
-- tabla ya sin estas columnas -- ALTER TABLE ADD no es idempotente por sí solo.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Fixtures') AND name = 'CompetitionType')
ALTER TABLE dbo.Fixtures ADD CompetitionType NVARCHAR(20) NULL;   -- 'LEAGUE' | 'UCL'
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Players') AND name = 'IsCurrentSquad')
ALTER TABLE dbo.Players ADD IsCurrentSquad BIT NOT NULL DEFAULT 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Predictions') AND name = 'BestScoreHome')
ALTER TABLE dbo.Predictions ADD BestScoreHome INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Predictions') AND name = 'BestScoreAway')
ALTER TABLE dbo.Predictions ADD BestScoreAway INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Predictions') AND name = 'BestScoreProb')
ALTER TABLE dbo.Predictions ADD BestScoreProb DECIMAL(6,4) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Predictions') AND name = 'LambdaHome')
ALTER TABLE dbo.Predictions ADD LambdaHome DECIMAL(8,4) NULL;    -- parámetro Poisson, no una probabilidad 0-1
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Predictions') AND name = 'LambdaAway')
ALTER TABLE dbo.Predictions ADD LambdaAway DECIMAL(8,4) NULL;
GO
