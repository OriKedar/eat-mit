-- v1 schema: places + user_places, per DATABASE_SCHEMA.md
-- Apply in the Supabase SQL Editor. Order matters: places before user_places.

create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision not null,
  lng double precision not null,
  address text,
  osm_id text,               -- Nominatim/OSM place reference, if available
  cuisine text,              -- free text, e.g. "Italian", "Sushi"
  created_at timestamptz default now()
);

alter table places enable row level security;

create policy "places are readable by anyone logged in"
  on places for select
  using (auth.role() = 'authenticated');

create policy "authenticated users can add places"
  on places for insert
  with check (auth.role() = 'authenticated');

create table if not exists user_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  status text not null check (status in ('want_to_go', 'visited')),
  rating int check (rating between 1 and 5),
  notes text,
  photo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, place_id)
);

alter table user_places enable row level security;

create policy "users can read their own entries"
  on user_places for select
  using (auth.uid() = user_id);

create policy "users can insert their own entries"
  on user_places for insert
  with check (auth.uid() = user_id);

create policy "users can update their own entries"
  on user_places for update
  using (auth.uid() = user_id);

create policy "users can delete their own entries"
  on user_places for delete
  using (auth.uid() = user_id);

-- Keep updated_at honest on edits.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_places_set_updated_at
  before update on user_places
  for each row execute function set_updated_at();

create index if not exists user_places_user_id_idx on user_places (user_id);
create index if not exists user_places_place_id_idx on user_places (place_id);
