-- Una reserva "activa" es la única fuente de verdad comercial de un lote.
-- No hay DELETE físico: cancelar es un cambio de estado (ver docs §0.5),
-- así se conserva el historial (spec §32) y la auditoría (spec §33).
create table reservations (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references projects (id),
  lot_id             uuid not null references lots (id),
  client_id          uuid not null references clients (id),
  seller_number      smallint not null references sellers (seller_number),
  created_by_session uuid references seller_sessions (id),
  agreed_price       numeric not null check (agreed_price > 0),
  reservation_status text not null default 'active'
                        check (reservation_status in ('active', 'cancelled', 'completed')),
  created_at         timestamptz not null default now(),
  effective_at       timestamptz not null default now(),
  notes              text
);
create index reservations_lot_id_idx on reservations (lot_id);
create index reservations_project_id_idx on reservations (project_id);
create index reservations_seller_number_idx on reservations (seller_number);
create index reservations_client_id_idx on reservations (client_id);

-- Invariante de concurrencia crítico (spec §35): a lo sumo una reserva
-- activa por lote, garantizado por Postgres. Dos vendedores insertando al
-- mismo tiempo para el mismo lote: uno gana, el otro recibe una violación
-- de índice único que la RPC create_reservation traduce a
-- 'LOT_ALREADY_RESERVED'.
create unique index one_active_reservation_per_lot
  on reservations (lot_id)
  where reservation_status = 'active';

create table payments (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations (id),
  project_id     uuid not null references projects (id), -- denormalizado, ver docs §0.6
  amount         numeric not null check (amount > 0),
  payment_type   text not null check (payment_type in ('initial', 'payment')),
  created_at     timestamptz not null default now(),
  effective_at   timestamptz not null default now(),
  created_by     uuid
);
create index payments_reservation_id_idx on payments (reservation_id);
create index payments_project_id_idx on payments (project_id);

-- project_id se deriva siempre de la reserva: evita que un valor
-- inconsistente llegue desde el cliente (aunque en la práctica solo las
-- RPCs SECURITY DEFINER insertan aquí).
create function set_payment_project_id() returns trigger as $$
begin
  select r.project_id into new.project_id
  from reservations r
  where r.id = new.reservation_id;
  return new;
end;
$$ language plpgsql;

create trigger payments_set_project_id
  before insert on payments
  for each row
  execute function set_payment_project_id();
