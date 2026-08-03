-- Adds the OSM amenity kind (restaurant/cafe/bar/...) to places, so the map
-- can show a distinct icon per place type. Nullable — older rows and
-- hand-placed pins simply render without a glyph.
alter table places add column if not exists kind text;
