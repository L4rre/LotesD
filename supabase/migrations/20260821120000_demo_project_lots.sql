-- Fases 6-7: "Proyecto Demo" con 4 manzanas (Y, Z, K, L) de 12 lotes cada
-- una. Es un mapa CONCEPTUAL, no reproduce ningún plano real (spec §8) --
-- la arquitectura queda lista para reemplazarlo por un plano real más
-- adelante (docs §8, §44), sin tocar el resto de la app.
--
-- lot_code sigue la numeración de la spec (Y-01..Y-12, etc.) y
-- geometry_id usa la convención "lot-{lot_code}" que el mapa SVG de la
-- Fase 8 va a usar para pintar cada lote (docs §8).
--
-- Todos quedan disponibles (sin reserva): las reservas/pagos de ejemplo
-- se siembran más adelante, cuando exista la UI para crearlos (Fases
-- 10-13), en vez de insertarlos aquí a mano saltándose las reglas de
-- negocio de las RPCs.
with demo_project as (
  insert into projects (name, description)
  values (
    'Proyecto Demo',
    'Terreno de demostración: 4 manzanas (Y, Z, K, L), 12 lotes cada una.'
  )
  returning id
)
insert into lots (
  project_id, block, lot_number, lot_code, area, front, depth,
  reference_price, geometry_id
)
select
  demo_project.id,
  b.block,
  n,
  b.block || '-' || lpad(n::text, 2, '0'),
  120,
  8,
  15,
  b.base_price + (n - 1) * 500,
  'lot-' || b.block || '-' || lpad(n::text, 2, '0')
from demo_project
cross join (values ('Y', 35000), ('Z', 40000), ('K', 45000), ('L', 50000)) as b(block, base_price)
cross join generate_series(1, 12) as n
order by b.block, n;
