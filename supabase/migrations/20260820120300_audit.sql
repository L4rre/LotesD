-- Bitácora de auditoría (spec §33). Nunca contiene contraseñas, solo
-- metadatos de la acción. Solo las RPCs SECURITY DEFINER escriben aquí.
create table audit_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid,
  seller_number smallint,
  action        text not null,
  entity_type   text not null,
  entity_id     uuid,
  details       jsonb,
  created_at    timestamptz not null default now()
);
create index audit_logs_created_at_idx on audit_logs (created_at desc);
create index audit_logs_entity_idx on audit_logs (entity_type, entity_id);
