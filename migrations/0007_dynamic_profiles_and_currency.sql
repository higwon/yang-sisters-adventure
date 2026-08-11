ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1
  CHECK(is_active IN (0, 1));

-- Keep the legacy default_currency column from 0006 intact because rebuilding
-- the parent trips table would cascade-delete existing trip data in D1.
ALTER TABLE trips ADD COLUMN currency_code TEXT
  CHECK(currency_code IS NULL OR (
    length(currency_code) = 3 AND currency_code = upper(currency_code)
  ));

UPDATE trips SET currency_code = default_currency;
