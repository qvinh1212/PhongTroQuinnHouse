-- Them state_version cho optimistic locking tren /sync
ALTER TABLE settings ADD COLUMN IF NOT EXISTS state_version text;

UPDATE settings
SET state_version = to_char(now(), 'YYYYMMDDHH24MISS') || '-init'
WHERE state_version IS NULL;
