-- Add per-campaign voice/language choice without replacing French defaults.
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS voice_language text NOT NULL DEFAULT 'fr';

ALTER TABLE campaigns
ADD CONSTRAINT campaigns_voice_language_check
CHECK (voice_language IN ('fr', 'ewe'));
