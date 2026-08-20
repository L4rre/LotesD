-- Smoke test funcional de Fase 2. No forma parte del proyecto: valida el
-- esquema contra un Postgres real antes de darlo por bueno.
\set ON_ERROR_STOP on
\pset pager off

-- Dos "usuarios" anónimos para simular dos vendedores.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', null),
  ('22222222-2222-2222-2222-222222222222', null);

-- Admin real.
insert into auth.users (id, email) values
  ('99999999-9999-9999-9999-999999999999', 'admin@lotesd.internal');
insert into profiles (id, role, display_name) values
  ('99999999-9999-9999-9999-999999999999', 'admin', 'Administrador');

set role authenticated;

-- Proyecto + un lote como admin.
select set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', false);
insert into projects (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Proyecto Demo');
insert into lots (id, project_id, block, lot_number, lot_code, geometry_id) values
  ('bbbbbbbb-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'K', 7, 'K-07', 'lot-K-07');

\echo '--- test 1: vendedor 01 (Pedro) inicia sesión ---'
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select * from seller_login(1::smallint, 'Pedro', 'vendedor2026');

\echo '--- test 2: mismo numero de vendedor desde otro dispositivo debe fallar (SELLER_IN_USE) ---'
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$
begin
  perform seller_login(1::smallint, 'Pedro', 'vendedor2026');
  raise exception 'DEBERIA HABER FALLADO: se permitio el mismo vendedor dos veces';
exception when others then
  raise notice 'OK: % ', sqlerrm;
end $$;

\echo '--- test 3: nombre incorrecto debe fallar (NAME_MISMATCH) ---'
do $$
begin
  perform seller_login(2::smallint, 'Pedro', 'vendedor2026');
  raise exception 'DEBERIA HABER FALLADO: nombre incorrecto aceptado';
exception when others then
  raise notice 'OK: %', sqlerrm;
end $$;

\echo '--- test 4: password incorrecta debe fallar (INVALID_PASSWORD) ---'
do $$
begin
  perform seller_login(2::smallint, 'Ana', 'password-mala');
  raise exception 'DEBERIA HABER FALLADO: password incorrecta aceptada';
exception when others then
  raise notice 'OK: %', sqlerrm;
end $$;

\echo '--- test 5: vendedor 02 (Ana) inicia sesion en su propio dispositivo ---'
select * from seller_login(2::smallint, 'Ana', 'vendedor2026');

\echo '--- test 6: Pedro reserva K-07 con inicial ---'
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select id as reservation_id from create_reservation(
  'bbbbbbbb-0000-0000-0000-000000000000', 'Juan Perez', '999888777', null,
  40000, 5000, 'cliente interesado'
) \gset

\echo '--- test 7: Ana intenta reservar el mismo lote -> debe fallar (LOT_ALREADY_RESERVED) ---'
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$
begin
  perform create_reservation(
    'bbbbbbbb-0000-0000-0000-000000000000', 'Otro Cliente', null, null, 40000, 1000, null
  );
  raise exception 'DEBERIA HABER FALLADO: doble reserva permitida';
exception when others then
  raise notice 'OK: %', sqlerrm;
end $$;

\echo '--- test 8: estado del lote tras la reserva (debe ser reserved, saldo 35000) ---'
select lot_code, status, total_paid, balance, paid_percentage from lot_status_view where lot_code = 'K-07';

\echo '--- test 9: Ana (vendedora) NO puede llamar admin_register_payment (FORBIDDEN) ---'
do $$
begin
  perform admin_register_payment((select id from reservations where lot_id = 'bbbbbbbb-0000-0000-0000-000000000000' and reservation_status = 'active'), 10000, now());
  raise exception 'DEBERIA HABER FALLADO: vendedor registro un pago administrativo';
exception when others then
  raise notice 'OK: %', sqlerrm;
end $$;

\echo '--- test 10: admin registra pago 10000, luego pago final 25000 -> PAID ---'
select set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', false);
select admin_register_payment((select id from reservations where lot_id = 'bbbbbbbb-0000-0000-0000-000000000000' and reservation_status = 'active'), 10000, now());
select lot_code, status, total_paid, balance, paid_percentage from lot_status_view where lot_code = 'K-07';
select admin_register_payment((select id from reservations where lot_id = 'bbbbbbbb-0000-0000-0000-000000000000' and reservation_status = 'active'), 25000, now());
select lot_code, status, total_paid, balance, paid_percentage from lot_status_view where lot_code = 'K-07';

\echo '--- test 11: sobrepago debe fallar (AMOUNT_EXCEEDS_BALANCE) ---'
do $$
begin
  perform admin_register_payment((select id from reservations where lot_id = 'bbbbbbbb-0000-0000-0000-000000000000' and reservation_status = 'active'), 1, now());
  raise exception 'DEBERIA HABER FALLADO: sobrepago permitido';
exception when others then
  raise notice 'OK: %', sqlerrm;
end $$;

\echo '--- test 12: vendedor NO puede escribir directo en reservations (RLS bloquea) ---'
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$
begin
  insert into reservations (project_id, lot_id, client_id, seller_number, agreed_price)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000',
          (select id from clients limit 1), 1, 1000);
  raise exception 'DEBERIA HABER FALLADO: insert directo permitido';
exception when others then
  raise notice 'OK: %', sqlerrm;
end $$;

\echo '--- test 13: vendedor NO puede leer el hash de la contrasena global ---'
do $$
begin
  perform seller_global_password_hash from system_settings;
  raise exception 'DEBERIA HABER FALLADO: se pudo leer system_settings';
exception when others then
  raise notice 'OK: %', sqlerrm;
end $$;

\echo '--- test 14: seller_access_state SI es legible (para pintar bloqueado/habilitado) ---'
select * from seller_access_state;

\echo '--- test 15: admin bloquea acceso global -> Ana pierde su sesion activa ---'
select set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', false);
select admin_toggle_seller_access(false);
select seller_number, status from seller_sessions order by seller_number;

\echo '--- test 16: con acceso bloqueado, un nuevo login debe fallar (SELLER_ACCESS_BLOCKED) ---'
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$
begin
  perform seller_login(2::smallint, 'Ana', 'vendedor2026');
  raise exception 'DEBERIA HABER FALLADO: login con acceso bloqueado';
exception when others then
  raise notice 'OK: %', sqlerrm;
end $$;

\echo '--- test 17: admin desbloquea y Ana puede volver a entrar ---'
select set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', false);
select admin_toggle_seller_access(true);
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select * from seller_login(2::smallint, 'Ana', 'vendedor2026');

\echo '--- test 18: seller_access_state es legible incluso como anon (sin sesión todavía) ---'
reset role;
set role anon;
select * from seller_access_state;
select set_config('request.jwt.claim.sub', '', false);
set role authenticated;

\echo '--- test 19: system_settings (con el hash) sigue sin ser legible ni por anon ni por authenticated ---'
set role anon;
do $$
begin
  perform seller_global_password_hash from system_settings;
  raise exception 'DEBERIA HABER FALLADO: anon pudo leer system_settings';
exception when others then
  raise notice 'OK: %', sqlerrm;
end $$;
set role authenticated;

\echo '--- TODOS LOS TESTS PASARON ---'
