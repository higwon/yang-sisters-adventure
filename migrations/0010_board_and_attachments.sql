CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT,
  url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX posts_trip_created_idx ON posts(trip_id, created_at DESC, id DESC);

CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX attachments_post_idx ON attachments(post_id);

CREATE TABLE post_conversions (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('planning', 'place', 'reservation')),
  target_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, target_type)
);
