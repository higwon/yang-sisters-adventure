CREATE TABLE planning_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  item_type TEXT NOT NULL,
  place_id INTEGER REFERENCES places(id) ON DELETE SET NULL,
  url TEXT,
  notes TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'inbox' CHECK(status IN ('inbox', 'scheduled')),
  schedule_item_id INTEGER REFERENCES schedule_items(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_planning_trip_status ON planning_items(trip_id, status, created_at);
