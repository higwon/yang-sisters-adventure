ALTER TABLE reservations ADD COLUMN start_at TEXT;
ALTER TABLE reservations ADD COLUMN end_at TEXT;

UPDATE reservations SET start_at = reservation_date WHERE reservation_date IS NOT NULL;

CREATE TABLE reservation_attachments (
  reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  attachment_id INTEGER NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  PRIMARY KEY (reservation_id, attachment_id)
);
