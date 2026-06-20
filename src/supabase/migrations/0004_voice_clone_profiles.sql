-- Voice cloning profiles with explicit consent requirements.
CREATE TABLE IF NOT EXISTS voice_clone_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  provider text NOT NULL DEFAULT 'openvoice',
  model text NOT NULL DEFAULT 'myshell-ai/OpenVoice',
  status text NOT NULL DEFAULT 'draft',
  consent_confirmed boolean NOT NULL DEFAULT false,
  sample_audio_url text,
  external_voice_id text,
  notes text,
  metadata jsonb,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT voice_clone_profiles_status_check CHECK (status IN ('draft', 'queued', 'training', 'ready', 'failed', 'disabled')),
  CONSTRAINT voice_clone_profiles_provider_check CHECK (provider IN ('openvoice', 'voxcpm', 'gpt-sovits', 'rvc', 'external'))
);

CREATE INDEX IF NOT EXISTS voice_clone_profiles_org_idx ON voice_clone_profiles(organization_id);
CREATE INDEX IF NOT EXISTS voice_clone_profiles_status_idx ON voice_clone_profiles(status);
