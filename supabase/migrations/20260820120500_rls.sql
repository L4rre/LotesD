-- Seguridad: RLS deny-by-default en toda tabla, más grants explícitos.
-- Ver docs/ARCHITECTURE.md §0.4 y §11 para el razonamiento completo.

-- lot_status_view debe respetar el RLS de las tablas que agrega (lots,
-- reservations, payments, clients, sellers), no los privilegios de quien
-- la creó. Como esas tablas ya tienen SELECT abierto a `authenticated`,
-- esto no cambia el comportamiento hoy, pero es correcto y a prueba de
-- futuro si esas políticas se endurecen.
alter view lot_status_view set (security_invoker = true);
grant select on lot_status_view to authenticated;

-- system_settings_public es la excepción deliberada: existe justamente
-- para exponer una sola columna seleccionable sin heredar el bloqueo total
-- de la tabla base (ver más abajo). No lleva security_invoker.

create function is_admin() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- sellers: catálogo de 10 vendedores.
alter table sellers enable row level security;
grant select on sellers to authenticated;
grant update (display_name) on sellers to authenticated;
create policy sellers_select on sellers for select to authenticated using (true);
create policy sellers_admin_update on sellers for update to authenticated
  using (is_admin()) with check (is_admin());

-- profiles: solo identidades admin.
alter table profiles enable row level security;
grant select on profiles to authenticated;
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or is_admin());

-- projects / lots / clients: datos maestros, escritura directa solo admin
-- (ver docs §0.4 — no son críticos para concurrencia).
alter table projects enable row level security;
grant select, insert, update, delete on projects to authenticated;
create policy projects_select on projects for select to authenticated using (true);
create policy projects_admin_write on projects for all to authenticated
  using (is_admin()) with check (is_admin());

alter table lots enable row level security;
grant select, insert, update, delete on lots to authenticated;
create policy lots_select on lots for select to authenticated using (true);
create policy lots_admin_write on lots for all to authenticated
  using (is_admin()) with check (is_admin());

alter table clients enable row level security;
grant select, insert, update, delete on clients to authenticated;
create policy clients_select on clients for select to authenticated using (true);
create policy clients_admin_write on clients for all to authenticated
  using (is_admin()) with check (is_admin());

-- reservations / payments / seller_sessions / system_settings: sin
-- políticas de escritura para ningún rol. Toda mutación pasa por RPC
-- SECURITY DEFINER (ver 20260820120600_functions.sql), que corre como el
-- dueño de las funciones y por lo tanto no necesita estas políticas.
alter table reservations enable row level security;
grant select on reservations to authenticated;
create policy reservations_select on reservations for select to authenticated using (true);

alter table payments enable row level security;
grant select on payments to authenticated;
create policy payments_select on payments for select to authenticated using (true);

alter table seller_sessions enable row level security;
grant select on seller_sessions to authenticated;
create policy seller_sessions_select on seller_sessions for select to authenticated using (true);

-- system_settings: cero políticas de SELECT/INSERT/UPDATE/DELETE para
-- `authenticated` -- ni el admin lee esta tabla directamente. La columna
-- de hash de la contraseña global nunca es seleccionable desde el
-- cliente (spec §17). Todo acceso pasa por RPC o por la vista pública.
alter table system_settings enable row level security;
revoke all on system_settings from authenticated, anon;

-- Vista deliberadamente sin RLS propio (ejecuta con privilegios de quien
-- la definió, que sí puede leer system_settings): expone únicamente el
-- estado de bloqueo y la fecha, nunca el hash.
grant select on system_settings_public to authenticated, anon;

-- audit_logs: solo lectura para admin; escritura solo vía RPC.
alter table audit_logs enable row level security;
grant select on audit_logs to authenticated;
create policy audit_logs_admin_select on audit_logs for select to authenticated
  using (is_admin());
