-- Ajuste de arquitectura pedido tras revisar la Fase 16-18 en vivo:
--
-- 1. `front`/`depth` asumían un lote rectangular perfecto (frente = lado
--    opuesto, fondo = lado opuesto). Hay terrenos con lotes irregulares
--    (cada lado mide distinto). Se reemplaza por 4 lados independientes:
--    front/back/left_side/right_side. Uno regular simplemente tiene
--    front=back y left_side=right_side; uno irregular no. El mapa sigue
--    siendo un dibujo conceptual (spec §8, no hay plano real todavía), la
--    irregularidad solo se refleja en los números de la ficha del lote,
--    no en la forma dibujada.
-- 2. Un lote ya no tiene "costo aproximado": se retira `reference_price`
--    por completo (no solo se deja de mostrar) para no dejar una columna
--    viva con datos de demo que confundirían a futuro. El precio pactado
--    de una reserva (`reservations.agreed_price`) es un concepto distinto
--    y no se toca.
--
-- Orden importante: soltar la vista primero (depende de `depth`), agregar
-- las columnas nuevas, copiar los datos viejos a ellas, y solo después
-- soltar `depth`/`reference_price` -- así sirve tanto para una base nueva
-- (recién sembrada por la migración anterior) como para el proyecto real
-- ya migrado en Supabase.
drop view lot_status_view;

alter table lots add column back numeric check (back is null or back > 0);
alter table lots add column left_side numeric check (left_side is null or left_side > 0);
alter table lots add column right_side numeric check (right_side is null or right_side > 0);

update lots set back = front, left_side = depth, right_side = depth;

alter table lots drop column depth;
alter table lots drop column reference_price;

-- lot_status_view: se recrea completa (no basta un CREATE OR REPLACE
-- porque cambia el conjunto de columnas), incluyendo de nuevo el
-- security_invoker y los grants que trae 20260820120500_rls.sql.

create view lot_status_view as
select
  l.id as lot_id,
  l.project_id,
  l.block,
  l.lot_number,
  l.lot_code,
  l.area,
  l.front,
  l.back,
  l.left_side,
  l.right_side,
  l.geometry_id,
  r.id as active_reservation_id,
  r.client_id,
  c.name as client_name,
  r.seller_number,
  s.display_name as seller_name,
  r.agreed_price,
  r.effective_at as reserved_at,
  r.notes as reservation_notes,
  coalesce(p.total_paid, 0) as total_paid,
  case
    when r.id is not null then greatest(r.agreed_price - coalesce(p.total_paid, 0), 0)
    else null
  end as balance,
  case
    when r.id is not null and r.agreed_price > 0
      then round(least(coalesce(p.total_paid, 0) / r.agreed_price, 1) * 100, 1)
    else null
  end as paid_percentage,
  case
    when r.id is null then 'available'
    when coalesce(p.total_paid, 0) >= r.agreed_price then 'paid'
    else 'reserved'
  end as status
from lots l
left join reservations r
  on r.lot_id = l.id and r.reservation_status = 'active'
left join clients c on c.id = r.client_id
left join sellers s on s.seller_number = r.seller_number
left join lateral (
  select sum(pay.amount) as total_paid
  from payments pay
  where pay.reservation_id = r.id
) p on true;

alter view lot_status_view set (security_invoker = true);
grant select on lot_status_view to authenticated;
