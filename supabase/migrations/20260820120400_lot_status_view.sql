-- Estado comercial de cada lote, siempre calculado, nunca almacenado
-- (spec §10, §11, §30). Es la única fuente de verdad para el color del
-- mapa (🟢/🟡/🔴) y para saldo/porcentaje pagado.
create view lot_status_view as
select
  l.id as lot_id,
  l.project_id,
  l.block,
  l.lot_number,
  l.lot_code,
  l.area,
  l.front,
  l.depth,
  l.reference_price,
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
