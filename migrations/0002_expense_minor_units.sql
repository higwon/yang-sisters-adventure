CREATE TABLE expenses_v2 (
  id TEXT PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
  currency TEXT NOT NULL CHECK(currency IN ('KRW', 'PHP')),
  paid_by INTEGER NOT NULL REFERENCES users(id),
  expense_date TEXT NOT NULL,
  category TEXT NOT NULL,
  notes TEXT,
  schedule_item_id INTEGER REFERENCES schedule_items(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expense_participants_v2 (
  expense_id TEXT NOT NULL REFERENCES expenses_v2(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  share_amount_minor INTEGER NOT NULL CHECK(share_amount_minor >= 0),
  PRIMARY KEY(expense_id, user_id)
);

INSERT INTO expenses_v2 (
  id, trip_id, title, amount_minor, currency, paid_by,
  expense_date, category, notes, schedule_item_id, created_at
)
SELECT
  'legacy-' || id,
  trip_id,
  title,
  CAST(ROUND(amount * CASE WHEN currency = 'PHP' THEN 100 ELSE 1 END) AS INTEGER),
  currency,
  paid_by,
  expense_date,
  category,
  notes,
  schedule_item_id,
  created_at
FROM expenses;

INSERT INTO expense_participants_v2 (expense_id, user_id, share_amount_minor)
SELECT
  'legacy-' || ep.expense_id,
  ep.user_id,
  CAST(ROUND(ep.share_amount * CASE WHEN e.currency = 'PHP' THEN 100 ELSE 1 END) AS INTEGER)
FROM expense_participants ep
JOIN expenses e ON e.id = ep.expense_id;

DROP TABLE expense_participants;
DROP TABLE expenses;
ALTER TABLE expenses_v2 RENAME TO expenses;
ALTER TABLE expense_participants_v2 RENAME TO expense_participants;

CREATE INDEX idx_expenses ON expenses(trip_id, expense_date);
CREATE INDEX idx_participants ON expense_participants(user_id);
