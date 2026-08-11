ALTER TABLE schedule_items ADD COLUMN end_next_day INTEGER NOT NULL DEFAULT 0 CHECK(end_next_day IN (0, 1));
