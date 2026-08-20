-- NOTA: Postgres otorga EXECUTE a PUBLIC en funciones nuevas por defecto.
-- Al final de este archivo se revoca eso y se otorga solo a `authenticated`
-- (nunca a `anon`), para no ampliar la superficie de ataque más allá de lo
-- necesario, aunque cada función ya valida auth.uid()/is_admin() adentro.

-- Funciones RPC SECURITY DEFINER: único punto de escritura para
-- reservations, payments, seller_sessions y system_settings
-- (ver docs/ARCHITECTURE.md §0.4, §4, §5, §6, §7). Corren como el dueño de
-- las funciones (postgres), que es también dueño de las tablas y por lo
-- tanto no está sujeto a RLS -- así no hace falta ninguna política de
-- escritura para `authenticated` en esas tablas.

-- Vendedor activo (si existe) para el auth.uid() que llama. Se usa desde
-- dentro de las demás funciones para no confiar en un seller_number que
-- el cliente pudiera enviar como parámetro.
create function current_seller_number() returns smallint
language sql
stable
security definer
set search_path = public
as $$
  select seller_number
  from seller_sessions
  where auth_user_id = auth.uid() and status = 'active'
  order by created_at desc
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- Vendedores: login, heartbeat, logout
-- ---------------------------------------------------------------------

create function seller_login(p_seller_number smallint, p_name text, p_password text)
returns seller_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings system_settings;
  v_seller sellers;
  v_session seller_sessions;
begin
  if auth.uid() is null then
    raise exception 'NO_AUTH_SESSION';
  end if;

  select * into v_settings from system_settings where id = true;
  if not v_settings.seller_access_enabled then
    raise exception 'SELLER_ACCESS_BLOCKED';
  end if;

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

  -- Libera sesiones abandonadas (pestaña cerrada/crasheada) antes de
  -- intentar reclamar el número (docs §5).
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

create function seller_heartbeat(p_session_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update seller_sessions
  set last_heartbeat = now()
  where id = p_session_id and auth_user_id = auth.uid() and status = 'active';

  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;
end;
$$;

create function seller_logout(p_session_id uuid, p_reason text default 'manual') returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_number smallint;
begin
  update seller_sessions
  set status = 'closed'
  where id = p_session_id and auth_user_id = auth.uid()
  returning seller_number into v_seller_number;

  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  insert into audit_logs (user_id, seller_number, action, entity_type, entity_id, details)
  values (auth.uid(), v_seller_number, 'seller_logout', 'seller_sessions', p_session_id,
          jsonb_build_object('reason', p_reason));
end;
$$;

-- ---------------------------------------------------------------------
-- Reservas
-- ---------------------------------------------------------------------

create function create_reservation(
  p_lot_id uuid,
  p_client_name text,
  p_client_phone text,
  p_client_dni text,
  p_agreed_price numeric,
  p_initial_amount numeric,
  p_notes text
) returns reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_number smallint;
  v_session_id uuid;
  v_project_id uuid;
  v_client_id uuid;
  v_reservation reservations;
begin
  select seller_number, id into v_seller_number, v_session_id
  from seller_sessions
  where auth_user_id = auth.uid() and status = 'active'
  order by created_at desc
  limit 1;

  if v_seller_number is null then
    raise exception 'NO_ACTIVE_SELLER_SESSION';
  end if;

  if p_agreed_price is null or p_agreed_price <= 0 then
    raise exception 'INVALID_PRICE';
  end if;
  if p_initial_amount is not null and p_initial_amount < 0 then
    raise exception 'INVALID_INITIAL_AMOUNT';
  end if;
  if p_client_name is null or trim(p_client_name) = '' then
    raise exception 'CLIENT_NAME_REQUIRED';
  end if;

  select project_id into v_project_id from lots where id = p_lot_id;
  if v_project_id is null then
    raise exception 'LOT_NOT_FOUND';
  end if;

  insert into clients (name, phone, dni)
  values (trim(p_client_name), nullif(trim(p_client_phone), ''), nullif(trim(p_client_dni), ''))
  returning id into v_client_id;

  begin
    insert into reservations (
      project_id, lot_id, client_id, seller_number, created_by_session,
      agreed_price, notes
    )
    values (
      v_project_id, p_lot_id, v_client_id, v_seller_number, v_session_id,
      p_agreed_price, nullif(trim(p_notes), '')
    )
    returning * into v_reservation;
  exception when unique_violation then
    raise exception 'LOT_ALREADY_RESERVED';
  end;

  if p_initial_amount is not null and p_initial_amount > 0 then
    insert into payments (reservation_id, amount, payment_type, created_by)
    values (v_reservation.id, p_initial_amount, 'initial', auth.uid());
  end if;

  insert into audit_logs (user_id, seller_number, action, entity_type, entity_id, details)
  values (
    auth.uid(), v_seller_number, 'reservation_created', 'reservations', v_reservation.id,
    jsonb_build_object(
      'lot_id', p_lot_id, 'agreed_price', p_agreed_price, 'initial_amount', p_initial_amount
    )
  );

  return v_reservation;
end;
$$;

-- ---------------------------------------------------------------------
-- Pagos y fechas (solo administrador)
-- ---------------------------------------------------------------------

create function admin_register_payment(
  p_reservation_id uuid,
  p_amount numeric,
  p_effective_at timestamptz default now()
) returns payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation reservations;
  v_total_paid numeric;
  v_payment payments;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  select * into v_reservation from reservations where id = p_reservation_id;
  if v_reservation is null then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;
  if v_reservation.reservation_status <> 'active' then
    raise exception 'RESERVATION_NOT_ACTIVE';
  end if;

  select coalesce(sum(amount), 0) into v_total_paid
  from payments where reservation_id = p_reservation_id;

  if v_total_paid + p_amount > v_reservation.agreed_price then
    raise exception 'AMOUNT_EXCEEDS_BALANCE';
  end if;

  insert into payments (reservation_id, amount, payment_type, created_by, effective_at)
  values (p_reservation_id, p_amount, 'payment', auth.uid(), coalesce(p_effective_at, now()))
  returning * into v_payment;

  insert into audit_logs (user_id, action, entity_type, entity_id, details)
  values (
    auth.uid(), 'payment_registered', 'payments', v_payment.id,
    jsonb_build_object('reservation_id', p_reservation_id, 'amount', p_amount)
  );

  return v_payment;
end;
$$;

create function admin_update_payment(
  p_payment_id uuid,
  p_amount numeric,
  p_effective_at timestamptz
) returns payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment payments;
  v_reservation reservations;
  v_total_paid_others numeric;
  v_old jsonb;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  select * into v_payment from payments where id = p_payment_id;
  if v_payment is null then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  select * into v_reservation from reservations where id = v_payment.reservation_id;

  select coalesce(sum(amount), 0) into v_total_paid_others
  from payments where reservation_id = v_payment.reservation_id and id <> p_payment_id;

  if v_total_paid_others + p_amount > v_reservation.agreed_price then
    raise exception 'AMOUNT_EXCEEDS_BALANCE';
  end if;

  v_old := jsonb_build_object('amount', v_payment.amount, 'effective_at', v_payment.effective_at);

  update payments
  set amount = p_amount,
      effective_at = coalesce(p_effective_at, effective_at)
  where id = p_payment_id
  returning * into v_payment;

  insert into audit_logs (user_id, action, entity_type, entity_id, details)
  values (
    auth.uid(), 'payment_updated', 'payments', p_payment_id,
    jsonb_build_object('before', v_old, 'after',
      jsonb_build_object('amount', v_payment.amount, 'effective_at', v_payment.effective_at))
  );

  return v_payment;
end;
$$;

create function admin_update_reservation_effective_date(
  p_reservation_id uuid,
  p_effective_at timestamptz
) returns reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation reservations;
  v_old timestamptz;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  select effective_at into v_old from reservations where id = p_reservation_id;
  if v_old is null then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;

  update reservations
  set effective_at = p_effective_at
  where id = p_reservation_id
  returning * into v_reservation;

  insert into audit_logs (user_id, action, entity_type, entity_id, details)
  values (
    auth.uid(), 'reservation_date_updated', 'reservations', p_reservation_id,
    jsonb_build_object('before', v_old, 'after', p_effective_at)
  );

  return v_reservation;
end;
$$;

-- ---------------------------------------------------------------------
-- Configuración global (solo administrador)
-- ---------------------------------------------------------------------

create function admin_set_global_password(p_new_password text) returns void
language plpgsql
security definer
set search_path = public
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

create function admin_toggle_seller_access(p_enabled boolean) returns void
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

  update system_settings
  set seller_access_enabled = p_enabled,
      updated_at = now(),
      updated_by = auth.uid()
  where id = true;

  v_closed_count := 0;
  if not p_enabled then
    -- "pierden acceso" = corte inmediato, no solo bloqueo de nuevos logins
    -- (docs §5).
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

-- ---------------------------------------------------------------------
-- Privilegios: solo `authenticated` puede invocar estas RPCs.
-- ---------------------------------------------------------------------

revoke execute on function current_seller_number() from public;
revoke execute on function seller_login(smallint, text, text) from public;
revoke execute on function seller_heartbeat(uuid) from public;
revoke execute on function seller_logout(uuid, text) from public;
revoke execute on function create_reservation(uuid, text, text, text, numeric, numeric, text) from public;
revoke execute on function admin_register_payment(uuid, numeric, timestamptz) from public;
revoke execute on function admin_update_payment(uuid, numeric, timestamptz) from public;
revoke execute on function admin_update_reservation_effective_date(uuid, timestamptz) from public;
revoke execute on function admin_set_global_password(text) from public;
revoke execute on function admin_toggle_seller_access(boolean) from public;

grant execute on function current_seller_number() to authenticated;
grant execute on function seller_login(smallint, text, text) to authenticated;
grant execute on function seller_heartbeat(uuid) to authenticated;
grant execute on function seller_logout(uuid, text) to authenticated;
grant execute on function create_reservation(uuid, text, text, text, numeric, numeric, text) to authenticated;
grant execute on function admin_register_payment(uuid, numeric, timestamptz) to authenticated;
grant execute on function admin_update_payment(uuid, numeric, timestamptz) to authenticated;
grant execute on function admin_update_reservation_effective_date(uuid, timestamptz) to authenticated;
grant execute on function admin_set_global_password(text) to authenticated;
grant execute on function admin_toggle_seller_access(boolean) to authenticated;
