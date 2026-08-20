-- Catálogo de vendedores. Filas fijas (1..10 en la demo), nombre configurable
-- por el administrador. No está ligado a auth.users: los vendedores comparten
-- una única contraseña global (ver system_settings + función seller_login).
create table sellers (
  seller_number smallint primary key check (seller_number between 1 and 10),
  display_name  text not null,
  created_at    timestamptz not null default now()
);

-- Identidades reales de Supabase Auth. En v1 solo hay administradores: el
-- vendedor no tiene cuenta individual (ver docs/ARCHITECTURE.md §0.3).
create table profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         text not null check (role = 'admin'),
  display_name text,
  created_at   timestamptz not null default now()
);

create table projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table lots (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects (id) on delete cascade,
  block           text not null,
  lot_number      int not null check (lot_number > 0),
  lot_code        text not null,
  area            numeric check (area is null or area > 0),
  front           numeric check (front is null or front > 0),
  depth           numeric check (depth is null or depth > 0),
  reference_price numeric check (reference_price is null or reference_price > 0),
  geometry_id     text not null,
  created_at      timestamptz not null default now(),
  unique (project_id, lot_code)
);
create index lots_project_id_idx on lots (project_id);

create table clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  dni        text,
  notes      text,
  created_at timestamptz not null default now()
);
