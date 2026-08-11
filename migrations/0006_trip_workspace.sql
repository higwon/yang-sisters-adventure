ALTER TABLE trips ADD COLUMN default_currency TEXT NOT NULL DEFAULT 'KRW'
  CHECK(default_currency IN ('KRW', 'PHP'));

UPDATE trips SET default_currency = 'PHP' WHERE id = 1;
