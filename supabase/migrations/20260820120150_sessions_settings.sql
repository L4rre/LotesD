-- Exclusividad de sesión por vendedor (spec §19) + heartbeat técnico
-- (docs §5). auth_user_id es el uid de una sesión anónima de Supabase Auth,
-- no de una cuenta individual: el vendedor comparte contraseña global, su
-- "identidad" real vive en esta tabla, no en auth.users.
create table seller_sessions (
  id             uuid primary key default gen_random_uuid(),
  seller_number  smallint not null references sellers (seller_number),
  auth_user_id   uuid not null references auth.users (id) on delete cascade,
  status         text not null default 'active' check (status in ('active', 'closed')),
  last_heartbeat timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

-- Invariante de concurrencia (spec §19, §35): a lo sumo una sesión activa
-- por número de vendedor, garantizado por Postgres, no por JavaScript.
create unique index one_active_session_per_seller
  on seller_sessions (seller_number)
  where status = 'active';

create index seller_sessions_auth_user_id_idx on seller_sessions (auth_user_id);

-- Fila única de configuración global (spec §18, §17).
create table system_settings (
  id                           boolean primary key default true check (id),
  seller_access_enabled        boolean not null default true,
  seller_global_password_hash  text not null,
  updated_at                   timestamptz not null default now(),
  updated_by                   uuid
);

insert into system_settings (id, seller_access_enabled, seller_global_password_hash)
values (true, true, crypt('vendedor2026', gen_salt('bf')));

-- Vista pública sin la columna de hash: es lo único que el cliente puede
-- leer directamente para pintar "bloqueado/habilitado" (docs §5). La
-- verificación real de la contraseña ocurre solo dentro de seller_login().
create view system_settings_public as
select seller_access_enabled, updated_at
from system_settings;
