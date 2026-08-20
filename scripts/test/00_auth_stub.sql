-- Stub mínimo del esquema `auth` de Supabase, SOLO para probar localmente
-- las migraciones contra un Postgres real (no forma parte del proyecto).
-- Reproduce lo justo para que RLS + SECURITY DEFINER + auth.uid() se
-- comporten igual que en Supabase.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

-- auth.uid(): en Supabase lee el claim "sub" del JWT vía una variable de
-- sesión. Acá se simula con una variable de sesión que los tests setean
-- con `select set_config('request.jwt.claim.sub', '<uuid>', false);`
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;
grant select on auth.users to authenticated, anon;
