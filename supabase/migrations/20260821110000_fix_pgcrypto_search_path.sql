-- Fix: en Supabase, pgcrypto se instala en el esquema `extensions`, no en
-- `public` (a diferencia de un Postgres genérico, donde `create extension`
-- sin esquema explícito lo deja en `public`). Las funciones que llaman a
-- crypt()/gen_salt() fijaban `search_path = public` a secas, así que no
-- encontraban la función y fallaban con:
--   "function crypt(text, text) does not exist"
-- Esto no se detectó al probar contra un Postgres genérico (Fase 2) porque
-- ahí pgcrypto sí queda en `public`. Se agrega `extensions` al search_path
-- de las dos funciones que dependen de pgcrypto.

create or replace function seller_login(p_seller_number smallint, p_name text, p_password text)
returns seller_sessions
language plpgsql
security definer
set search_path = public, extensions
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

create or replace function admin_set_global_password(p_new_password text) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_new_password is null or length(p_new_password) < 6 then
    raise exception 'PASSWORD_TOO_SHORT';
  end if;

  update system_settings
  set seller_global_password_hash = crypt(p_new_password, gen_salt('bf')),
      updated_at = now(),
      updated_by = auth.uid()
  where id = true;

  insert into audit_logs (user_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'global_password_changed', 'system_settings', null, null);
end;
$$;
