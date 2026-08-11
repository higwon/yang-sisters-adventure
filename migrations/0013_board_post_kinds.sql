ALTER TABLE posts ADD COLUMN kind TEXT NOT NULL DEFAULT 'general';
ALTER TABLE posts ADD COLUMN title TEXT;
ALTER TABLE posts ADD COLUMN map_url TEXT;

CREATE INDEX posts_trip_kind_created_idx ON posts(trip_id, kind, created_at DESC);
