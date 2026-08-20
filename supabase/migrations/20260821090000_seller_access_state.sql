-- Corrección de diseño encontrada al implementar Realtime para el
-- bloqueo global (Fase 4): Supabase Realtime transmite la fila completa
-- de la tabla replicada y solo respeta RLS por fila, no los grants por
-- columna que usábamos para ocultar seller_global_password_hash. Si
-- hubiéramos agregado `system_settings` a la publicación de Realtime,
-- cualquier cliente suscrito habría recibido el hash de la contraseña
-- global en cada evento, sin importar que SELECT directo lo bloqueara.
--
-- Solución: separar el estado público (bloqueado/habilitado) del secreto
-- en una tabla propia que nunca contiene nada sensible, así sí puede
-- exponerse por Realtime sin riesgo.

create table seller_access_state (
  id         boolean primary key default true check (id),
  enabled    boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into seller_access_state (id, enabled)
select true, seller_access_enabled from system_settings where id = true;

alter table seller_access_state enable row level security;
grant select on seller_access_state to authenticated, anon;
create policy seller_access_state_select on seller_access_state for select
  to authenticated, anon using (true);

-- Ya no hace falta la vista ni la columna: el estado público vive en su
-- propia tabla, sin secretos.
drop view system_settings_public;
alter table system_settings drop column seller_access_enabled;

create or replace function seller_login(p_seller_number smallint, p_name text, p_password text)
returns seller_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings system_settings;
  v_access_enabled boolean;
  v_seller sellers;
  v_session seller_sessions;
begin
  if auth.uid() is null then
    raise exception 'NO_AUTH_SESSION';
  end if;

  select enabled into v_access_enabled from seller_access_state where id = true;
  if not v_access_enabled then
    raise exception 'SELLER_ACCESS_BLOCKED';
  end if;

  select * into v_settings from system_settings where id = true;

  select * into v_seller from sellers where seller_number = p_seller_number;
  if v_seller is null then
    raise exception 'SELLER_NOT_FOUND';
  end if;
  if lower(trim(v_seller.display_name)) <> lower(trim(p_name)) then
    raise exception 'NAME_MISMATCH';
  end if;
  if crypt(p_password, v_settings.seller_global_password_hash) <> v_settings.seller_global_password_hash then
    raise exception 'INVALID_PASSWORD';
  end if;

  update seller_sessions
  set status = 'closed'
  where status = 'active' and last_heartbeat < now() - interval '3 minutes';

  begin
    insert into seller_sessions (seller_number, auth_user_id)
    values (p_seller_number, auth.uid())
    returning * into v_session;
  exception when unique_violation then
    raise exception 'SELLER_IN_USE';
  end;

  insert into audit_logs (user_id, seller_number, action, entity_type, entity_id, details)
  values (auth.uid(), p_seller_number, 'seller_login', 'seller_sessions', v_session.id, null);

  return v_session;
end;
$$;

create or replace function admin_toggle_seller_access(p_enabled boolean) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed_count int;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  update seller_access_state
  set enabled = p_enabled,
      updated_at = now(),
      updated_by = auth.uid()
  where id = true;

  v_closed_count := 0;
  if not p_enabled then
    with closed as (
      update seller_sessions
      set status = 'closed'
      where status = 'active'
      returning 1
    )
    select count(*) into v_closed_count from closed;
  end if;

  insert into audit_logs (user_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    case when p_enabled then 'seller_access_unblocked' else 'seller_access_blocked' end,
    'system_settings', null,
    jsonb_build_object('sessions_force_closed', v_closed_count)
  );
end;
$$;

-- Habilita Realtime para el estado de bloqueo y las sesiones de vendedor
-- (docs §5, §9). En un Postgres genérico (p. ej. las pruebas locales de la
-- Fase 2) la publicación `supabase_realtime` no existe, así que esto se
-- salta sin error fuera de un proyecto Supabase real.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.seller_access_state';
    execute 'alter publication supabase_realtime add table public.seller_sessions';
  end if;
end $$;
