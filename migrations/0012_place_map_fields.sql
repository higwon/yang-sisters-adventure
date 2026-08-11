ALTER TABLE places ADD COLUMN latitude REAL;
ALTER TABLE places ADD COLUMN longitude REAL;
ALTER TABLE places ADD COLUMN photo_url TEXT;

CREATE INDEX places_trip_coordinates_idx ON places(trip_id, latitude, longitude);
