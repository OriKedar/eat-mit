# Database Schema (Supabase / Postgres)

This is the source of truth for the data model. Apply these as SQL migrations
in the Supabase SQL editor, or have Claude Code generate migration files from
this doc.

## v1 tables (build these now)

### `places`

Shared, global table — a restaurant only needs to exist once, regardless of
how many users have saved it.

```sql
create table places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision not null,
  lng double precision not null,
  address text,
  osm_id text,               -- Nominatim/OSM place reference, if available
  cuisine text,              -- free text, e.g. "Italian", "Sushi"
  created_at timestamptz default now()
);
```

- No RLS restriction needed on read (places are not sensitive, they're just
  restaurant locations). Anyone logged in can read.
- Insert allowed for any authenticated user (adding a new place to the shared
  pool is fine — it's just a location, not personal data).

```sql
alter table places enable row level security;

create policy "places are readable by anyone logged in"
  on places for select
  using (auth.role() = 'authenticated');

create policy "authenticated users can add places"
  on places for insert
  with check (auth.role() = 'authenticated');
```

### `user_places`

Per-user relationship to a place — this is where "want to go" vs "visited",
personal rating, and notes live. This table is the one that must be locked
down with RLS, since it's personal data.

```sql
create table user_places (
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
```

```sql
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
```

This is the critical safety mechanism: even if a frontend bug tried to fetch
or modify someone else's `user_places` row, Postgres itself would refuse it,
because `auth.uid()` (the currently logged-in user, verified by Supabase Auth)
would not match the row's `user_id`.

## Phase 2 tables (friends — do NOT build in v1, added later)

### `friendships`

```sql
create table friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz default now(),
  unique (user_id, friend_id)
);
```

RLS: a user can see friendship rows where they are either `user_id` or
`friend_id`. Only the `user_id` who sent the request can insert; either party
can update status to accepted (accepting a request) or delete (removing a
friend).

Once this exists, a "friends' places" view becomes a query joining
`friendships` → `user_places` → `places`, filtered to accepted friends only.

## Phase 3 tables (office/groups — later still)

### `groups`

```sql
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz default now()
);
```

### `group_members`

```sql
create table group_members (
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);
```

RLS: a user can read a group's data only if they appear in `group_members`
for that group. A "group map" view becomes: all `user_places` belonging to
users who are members of a given group, joined to `places`.

## Phase 4 (recommendations — later, exploratory)

No new tables needed at first — this is a query/algorithm problem over
existing `user_places` ratings (e.g., find friends whose ratings correlate
with yours on shared places, then surface places they rated highly that you
haven't visited). Worth revisiting once there's enough real rating data to
make this meaningful — premature to build against empty tables.

## Notes for whoever (Claude Code) applies this

- Apply tables in dependency order: `places` before `user_places`, `groups`
  before `group_members`, etc. (foreign keys require the referenced table to
  exist first.)
- Only build the **v1 tables** section right away. Phase 2/3/4 are documented
  here so the schema is designed with them in mind, not so they get built
  immediately — check `ROADMAP.md` before building anything beyond v1.
- `auth.users` is a Supabase-managed table already — don't try to create it.
