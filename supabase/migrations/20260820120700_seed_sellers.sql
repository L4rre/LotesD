-- Los 10 vendedores son parte del catálogo base del sistema (spec §15), no
-- datos de demo: existen en todo ambiente. Los nombres son los de ejemplo
-- de la especificación; el administrador puede renombrarlos cuando quiera
-- (UPDATE directo, ver política sellers_admin_update).
insert into sellers (seller_number, display_name) values
  (1, 'Pedro'),
  (2, 'Ana'),
  (3, 'Carlos'),
  (4, 'Luis'),
  (5, 'María'),
  (6, 'José'),
  (7, 'Rosa'),
  (8, 'Miguel'),
  (9, 'Laura'),
  (10, 'Daniel');
