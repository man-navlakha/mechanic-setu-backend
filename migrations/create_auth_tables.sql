-- Add google_id column to match new Google flow
ALTER TABLE users_customuser
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_users_customuser_google_id'
      AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX idx_users_customuser_google_id ON users_customuser (google_id);
  END IF;
END
$$;

-- Store OTP sessions for email-based flows
CREATE TABLE IF NOT EXISTS auth_otp_sessions (
  id BIGSERIAL PRIMARY KEY,
  session_key UUID NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users_customuser(id) ON DELETE CASCADE,
  otp_hash TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_otp_sessions_user ON auth_otp_sessions(user_id);
