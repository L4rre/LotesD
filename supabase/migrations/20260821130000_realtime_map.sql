-- Fase 15: Realtime en el mapa. `reservations` y `payments` ya tienen
-- SELECT abierto a `authenticated` (§11) y `payments.project_id` está
-- denormalizado justo para poder filtrar por terreno (§0.6), así que
-- agregarlas a la publicación es todo lo que hace falta -- a diferencia
-- de `system_settings` (§0.7), ninguna de las dos tiene columnas
-- sensibles que Realtime pudiera filtrar.
--
-- Igual que en 20260821090000: en un Postgres genérico (pruebas locales
-- de la Fase 2) la publicación `supabase_realtime` no existe, así que
-- esto se salta sin error fuera de un proyecto Supabase real.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.reservations';
    execute 'alter publication supabase_realtime add table public.payments';
  end if;
end $$;
