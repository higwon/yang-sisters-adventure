ALTER TABLE schedule_items ADD COLUMN url TEXT;
ALTER TABLE schedule_items ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

CREATE TABLE schedule_participants (
  schedule_item_id INTEGER NOT NULL REFERENCES schedule_items(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  PRIMARY KEY (schedule_item_id, user_id)
);

CREATE INDEX idx_schedule_participants_user ON schedule_participants(user_id);

