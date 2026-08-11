ALTER TABLE users ADD COLUMN google_sub TEXT;

CREATE UNIQUE INDEX idx_users_google_sub
  ON users(google_sub)
  WHERE google_sub IS NOT NULL;

CREATE TABLE oauth_states (
  id TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_oauth_states_expires_at ON oauth_states(expires_at);
