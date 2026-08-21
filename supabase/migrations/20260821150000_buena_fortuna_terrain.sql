-- Reemplaza el "Proyecto Demo" por el terreno real "Buena Fortuna" (5
-- manzanas: X-10, Y-10, Y-11, Z-10, Z-11 -- 78 lotes), a partir de la
-- tabla maestra verificada por el propietario (área/perímetro por lote,
-- transcritos tal cual, sin recalcular).
--
-- Cambio de esquema: la fuente real trae área + perímetro por lote, no
-- los 4 lados individuales que se agregaron en la migración anterior
-- (20260821140000) pensando en lotes irregulares -- esa idea no aplica a
-- los datos reales disponibles, así que se reemplaza por `perimeter`. La
-- ruta de la imagen de cotas (spec: una imagen por lote con sus medidas)
-- NO se guarda en la base -- se deriva en el frontend directamente del
-- `lot_code` (docs §15, evitar duplicar el mismo dato en dos lugares).

drop view lot_status_view;

alter table lots add column perimeter numeric check (perimeter is null or perimeter > 0);
alter table lots drop column front;
alter table lots drop column back;
alter table lots drop column left_side;
alter table lots drop column right_side;

-- Limpieza del Proyecto Demo: primero pagos y reservas (FK con
-- ON DELETE restringido por defecto), después los lotes. Se identifica
-- por nombre en vez de un id fijo porque el id real lo generó Supabase al
-- sembrarlo (gen_random_uuid()), no se conoce de antemano.
with demo as (
  select id from projects where name = 'Proyecto Demo'
)
delete from payments
where reservation_id in (
  select r.id from reservations r join demo on r.project_id = demo.id
);

with demo as (
  select id from projects where name = 'Proyecto Demo'
)
delete from reservations
where project_id in (select id from demo);

with demo as (
  select id from projects where name = 'Proyecto Demo'
)
delete from lots
where project_id in (select id from demo);

update projects
set name = 'Buena Fortuna',
    description = 'Habilitación urbana "Buenavista Sara II" -- Futura Urbanización Residencial Buena Fortuna. Manzanas X-10, Y-10, Y-11, Z-10, Z-11.'
where name = 'Proyecto Demo';

-- Si por alguna razón el proyecto demo no existe (ej. se corrió esta
-- migración en una base nueva sin la semilla de la Fase 6-7), se crea acá
-- para no depender de un orden de ejecución distinto.
insert into projects (name, description)
select 'Buena Fortuna', 'Habilitación urbana "Buenavista Sara II" -- Futura Urbanización Residencial Buena Fortuna. Manzanas X-10, Y-10, Y-11, Z-10, Z-11.'
where not exists (select 1 from projects where name = 'Buena Fortuna');

-- 78 lotes: (manzana, lote, lot_code, área m², perímetro ml, geometry_id).
-- Transcritos de la tabla maestra (Excel) verificada por el propietario;
-- lot_code = manzana sin guion + lote con 2 dígitos (ej. X10-05), para que
-- coincida con el nombre de archivo de la futura imagen de cotas
-- (/lot-details/X10-05.png).
insert into lots (project_id, block, lot_number, lot_code, area, perimeter, geometry_id)
select
  (select id from projects where name = 'Buena Fortuna'),
  v.block, v.lot_number, v.lot_code, v.area, v.perimeter, v.geometry_id
from (
  values
    ('X-10', 4, 'X10-04', 62.9, 46.3, 'lot-X10-04'),
    ('X-10', 5, 'X10-05', 160, 56, 'lot-X10-05'),
    ('X-10', 6, 'X10-06', 160, 56, 'lot-X10-06'),
    ('X-10', 7, 'X10-07', 160, 56, 'lot-X10-07'),
    ('X-10', 8, 'X10-08', 160, 56, 'lot-X10-08'),
    ('X-10', 9, 'X10-09', 160, 56, 'lot-X10-09'),
    ('X-10', 10, 'X10-10', 160, 56, 'lot-X10-10'),
    ('X-10', 11, 'X10-11', 160, 56, 'lot-X10-11'),
    ('X-10', 12, 'X10-12', 160, 56, 'lot-X10-12'),
    ('X-10', 13, 'X10-13', 160, 56, 'lot-X10-13'),
    ('X-10', 14, 'X10-14', 160, 56, 'lot-X10-14'),
    ('X-10', 15, 'X10-15', 160, 56, 'lot-X10-15'),
    ('X-10', 16, 'X10-16', 160, 56, 'lot-X10-16'),
    ('X-10', 17, 'X10-17', 160, 56, 'lot-X10-17'),
    ('X-10', 18, 'X10-18', 49.4, 44.95, 'lot-X10-18'),
    ('Y-10', 1, 'Y10-01', 160, 56, 'lot-Y10-01'),
    ('Y-10', 2, 'Y10-02', 160, 56, 'lot-Y10-02'),
    ('Y-10', 3, 'Y10-03', 160, 56, 'lot-Y10-03'),
    ('Y-10', 4, 'Y10-04', 160, 56, 'lot-Y10-04'),
    ('Y-10', 5, 'Y10-05', 160, 56, 'lot-Y10-05'),
    ('Y-10', 6, 'Y10-06', 160, 56, 'lot-Y10-06'),
    ('Y-10', 7, 'Y10-07', 160, 56, 'lot-Y10-07'),
    ('Y-10', 8, 'Y10-08', 160, 56, 'lot-Y10-08'),
    ('Y-10', 9, 'Y10-09', 160, 52, 'lot-Y10-09'),
    ('Y-10', 10, 'Y10-10', 160, 52, 'lot-Y10-10'),
    ('Y-10', 11, 'Y10-11', 160, 52, 'lot-Y10-11'),
    ('Y-10', 12, 'Y10-12', 160, 52, 'lot-Y10-12'),
    ('Y-10', 13, 'Y10-13', 160, 56, 'lot-Y10-13'),
    ('Y-10', 14, 'Y10-14', 160, 56, 'lot-Y10-14'),
    ('Y-10', 15, 'Y10-15', 160, 56, 'lot-Y10-15'),
    ('Y-10', 16, 'Y10-16', 160, 56, 'lot-Y10-16'),
    ('Y-10', 17, 'Y10-17', 160, 56, 'lot-Y10-17'),
    ('Y-10', 18, 'Y10-18', 160, 56, 'lot-Y10-18'),
    ('Y-10', 19, 'Y10-19', 160, 56, 'lot-Y10-19'),
    ('Y-10', 20, 'Y10-20', 160, 56, 'lot-Y10-20'),
    ('Y-10', 21, 'Y10-21', 160, 56, 'lot-Y10-21'),
    ('Y-10', 22, 'Y10-22', 160, 56, 'lot-Y10-22'),
    ('Y-10', 23, 'Y10-23', 160, 56, 'lot-Y10-23'),
    ('Y-10', 24, 'Y10-24', 160, 56, 'lot-Y10-24'),
    ('Y-10', 25, 'Y10-25', 160, 56, 'lot-Y10-25'),
    ('Y-11', 8, 'Y11-08', 94.48, 72.59, 'lot-Y11-08'),
    ('Y-11', 10, 'Y11-10', 112.88, 46.34, 'lot-Y11-10'),
    ('Y-11', 11, 'Y11-11', 160, 52, 'lot-Y11-11'),
    ('Y-11', 12, 'Y11-12', 160, 52, 'lot-Y11-12'),
    ('Y-11', 13, 'Y11-13', 160, 56, 'lot-Y11-13'),
    ('Y-11', 14, 'Y11-14', 160, 56, 'lot-Y11-14'),
    ('Y-11', 15, 'Y11-15', 160, 56, 'lot-Y11-15'),
    ('Y-11', 16, 'Y11-16', 160, 56, 'lot-Y11-16'),
    ('Y-11', 17, 'Y11-17', 156.24, 55.17, 'lot-Y11-17'),
    ('Y-11', 18, 'Y11-18', 145.52, 52.49, 'lot-Y11-18'),
    ('Y-11', 19, 'Y11-19', 134.8, 49.81, 'lot-Y11-19'),
    ('Y-11', 20, 'Y11-20', 124.44, 47.22, 'lot-Y11-20'),
    ('Y-11', 21, 'Y11-21', 160, 56, 'lot-Y11-21'),
    ('Y-11', 22, 'Y11-22', 108, 51.03, 'lot-Y11-22'),
    ('Z-10', 1, 'Z10-01', 160, 56, 'lot-Z10-01'),
    ('Z-10', 2, 'Z10-02', 160, 56, 'lot-Z10-02'),
    ('Z-10', 3, 'Z10-03', 160, 56, 'lot-Z10-03'),
    ('Z-10', 4, 'Z10-04', 109.9, 50.79, 'lot-Z10-04'),
    ('Z-10', 18, 'Z10-18', 145.52, 50.57, 'lot-Z10-18'),
    ('Z-10', 19, 'Z10-19', 160, 56, 'lot-Z10-19'),
    ('Z-10', 20, 'Z10-20', 160, 56, 'lot-Z10-20'),
    ('Z-10', 21, 'Z10-21', 160, 56, 'lot-Z10-21'),
    ('Z-10', 22, 'Z10-22', 160, 52, 'lot-Z10-22'),
    ('Z-10', 23, 'Z10-23', 160, 52, 'lot-Z10-23'),
    ('Z-10', 24, 'Z10-24', 160, 52, 'lot-Z10-24'),
    ('Z-10', 25, 'Z10-25', 160, 52, 'lot-Z10-25'),
    ('Z-11', 1, 'Z11-01', 109.8, 43.55, 'lot-Z11-01'),
    ('Z-11', 2, 'Z11-02', 119.76, 46.04, 'lot-Z11-02'),
    ('Z-11', 3, 'Z11-03', 129.72, 48.53, 'lot-Z11-03'),
    ('Z-11', 4, 'Z11-04', 85.29, 44.59, 'lot-Z11-04'),
    ('Z-11', 18, 'Z11-18', 102.9, 50.29, 'lot-Z11-18'),
    ('Z-11', 19, 'Z11-19', 160, 56, 'lot-Z11-19'),
    ('Z-11', 20, 'Z11-20', 160, 56, 'lot-Z11-20'),
    ('Z-11', 21, 'Z11-21', 160, 56, 'lot-Z11-21'),
    ('Z-11', 22, 'Z11-22', 160, 52, 'lot-Z11-22'),
    ('Z-11', 23, 'Z11-23', 160, 52, 'lot-Z11-23'),
    ('Z-11', 24, 'Z11-24', 160, 52, 'lot-Z11-24'),
    ('Z-11', 25, 'Z11-25', 28.24, 35.75, 'lot-Z11-25')
) as v(block, lot_number, lot_code, area, perimeter, geometry_id)
where not exists (
  select 1 from lots l
  join projects p on p.id = l.project_id
  where p.name = 'Buena Fortuna' and l.lot_code = v.lot_code
);

-- lot_status_view: se recrea completa (cambia el conjunto de columnas:
-- perimeter en vez de front/back/left_side/right_side), incluyendo de
-- nuevo el security_invoker y los grants que trae 20260820120500_rls.sql.
create view lot_status_view as
select
  l.id as lot_id,
  l.project_id,
  l.block,
  l.lot_number,
  l.lot_code,
  l.area,
  l.perimeter,
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
