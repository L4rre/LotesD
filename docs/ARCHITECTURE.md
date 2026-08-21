# Arquitectura — Webapp de Administración y Reserva de Terrenos

Este documento es el análisis previo exigido antes de programar (spec §57). Se
actualizará a medida que avancen las fases.

## 0. Decisiones que se apartan o precisan la especificación

La especificación (§39) autoriza modificar la estructura de datos "si existe
una razón técnica mejor". Estos son los puntos donde eso aplica, y por qué:

1. **`profiles` se separa en dos tablas: `sellers` y `profiles`.**
   La spec mezcla en `profiles` tanto `role` (admin) como `seller_number` /
   `display_name`. Pero los vendedores **no** tienen cuenta individual de
   Supabase Auth (la contraseña es global, compartida por los 10 — spec §17),
   mientras que el administrador sí necesita una cuenta real (email+password)
   para que Auth + RLS lo identifiquen. Mezclar ambos conceptos en una tabla
   ligada 1:1 a `auth.users` no funciona porque los vendedores no tienen fila
   en `auth.users` propia. Solución: `sellers` es un catálogo estático (10
   filas: número + nombre configurable), y `profiles` queda solo para
   identidades reales de Supabase Auth (el admin).

2. **La contraseña global no puede verificarse solo en el cliente.**
   El frontend solo tiene la `anon key` (pública). Si la verificación de la
   contraseña ocurriera en JS contra un valor leído de una tabla, cualquiera
   con la anon key podría leer el hash y atacarlo offline, o simplemente leer
   el valor si la política RLS fuera laxa. Solución: la contraseña se guarda
   como hash (pgcrypto `crypt()`/bcrypt) en `system_settings`, esa columna
   **nunca** es seleccionable desde el cliente (RLS deniega SELECT directo a
   la tabla), y la verificación ocurre dentro de una función Postgres
   `SECURITY DEFINER` (`seller_login`) invocada vía RPC. No hace falta Edge
   Function — Postgres RPC vía PostgREST es gratis en Supabase Free y es
   suficiente.

3. **Identidad de vendedor: Supabase Auth anónimo + tabla de sesión, no
   Auth "normal".**
   Supabase Auth está pensado para identidades individuales con su propio
   password. Acá los 10 vendedores comparten una única contraseña (spec §17),
   así que no tiene sentido crear 10 cuentas reales. Se usa
   `supabase.auth.signInAnonymously()` una vez por dispositivo/navegador para
   obtener un `auth.uid()` técnico, y la identidad "soy el Vendedor 01" se
   establece aparte, en `seller_sessions` (número de vendedor ↔ auth.uid()
   ↔ heartbeat). Toda escritura comercial (reservas, pagos, sesiones) pasa
   por funciones RPC `SECURITY DEFINER` que resuelven "qué vendedor es este
   auth.uid() ahora mismo" del lado del servidor — así no hace falta
   confiar en que el cliente declare correctamente su propio `seller_number`.

4. **Las tablas críticas para concurrencia y dinero no aceptan escritura
   directa desde el cliente — solo RPC.** `reservations`, `payments`,
   `seller_sessions` y `system_settings` **no** tienen políticas RLS de
   INSERT/UPDATE/DELETE para ningún rol (ni admin ni vendedor). Toda
   mutación pasa por funciones `SECURITY DEFINER` con las reglas de negocio
   embebidas (precio inmutable, vendedor no puede fechar hacia atrás,
   exclusividad de lote, exclusividad de sesión, sin sobrepago). Es la única
   forma de garantizar la regla crítica del §35 (dos vendedores no pueden
   reservar el mismo lote) sin confiar en JavaScript, y hace la auditoría
   trivial porque cada mutación pasa por un único punto que ya escribe en
   `audit_logs`.
   `projects`, `lots`, `clients` y `sellers` (datos maestros/de referencia,
   sin invariantes de concurrencia) sí tienen política RLS directa de
   escritura para `profiles.role = 'admin'` — así el admin puede cargar 8
   terrenos × 200 lotes por SQL/CSV sin pasar uno por uno por una RPC.
   Los vendedores nunca escriben esas tablas directamente: cuando crean un
   cliente lo hacen dentro de `create_reservation` (que sí es RPC).

5. **`reservation_status` incluye `cancelled`, no hay DELETE real.**
   La spec no es explícita sobre qué pasa si una reserva se cancela (§38
   lista la tabla sin ese detalle, §42 dice que el vendedor no puede
   "eliminar reservas", implicando que el admin sí podría eliminar algo).
   Pero §33 exige auditoría completa e §32 exige historial por lote. Un
   DELETE físico rompería ambas cosas. Se usa borrado lógico:
   `reservation_status IN ('active','cancelled','completed')`. Solo
   `active` cuenta para "lote reservado"; cancelar libera el lote sin borrar
   el historial.

6. **`payments.project_id` denormalizado.**
   No está en la lista mínima del §39, pero Supabase Realtime solo filtra
   eficientemente por columnas indexadas del propio evento. `payments` no
   tiene `project_id` directo (solo `reservation_id`), lo que impediría
   suscribirse "a los pagos del Terreno 1" de forma barata cuando existan
   ~1,600 lotes / 8 terrenos. Se agrega `project_id` a `payments`, copiado
   por trigger desde la reserva al insertar.

7. **`seller_access_state`, tabla separada de `system_settings` (encontrado
   al implementar la Fase 4).** El plan original tenía
   `seller_access_enabled` como columna de `system_settings`, la misma
   tabla que guarda el hash de la contraseña global, expuesta al cliente
   solo a través de la vista `system_settings_public` (sin la columna del
   hash). Eso funciona para lecturas puntuales, pero se rompe con
   Realtime: Supabase Realtime transmite la fila completa de la **tabla**
   replicada (no de una vista) y solo filtra por RLS a nivel de fila, no
   respeta los `GRANT`/`REVOKE` por columna. Si `system_settings` se
   hubiera agregado a la publicación de Realtime para que el bloqueo se
   viera en vivo, cualquier cliente suscrito habría recibido
   `seller_global_password_hash` en cada evento, sin importar que el
   SELECT directo lo bloqueara. Solución: mover `enabled` a una tabla
   propia (`seller_access_state`) que nunca contiene nada sensible, con
   RLS abierto (`using (true)`) a `anon` y `authenticated`, y esa es la
   que se agrega a la publicación de Realtime. `system_settings` queda
   solo con el hash y ya no necesita estar en Realtime ni tener política
   de SELECT alguna.

8. **`pgcrypto` vive en el esquema `extensions` en Supabase, no en
   `public` (encontrado al probar contra un proyecto Supabase real).**
   `seller_login` y `admin_set_global_password` fijaban `search_path =
   public` a secas, asumiendo que `create extension pgcrypto` deja
   `crypt()`/`gen_salt()` en `public` — cierto en un Postgres genérico
   (así se validó en la Fase 2), pero Supabase instala varias extensiones,
   pgcrypto incluida, en un esquema propio llamado `extensions`. El
   síntoma en producción fue el login de vendedor fallando con "Ocurrió un
   error inesperado", y en los logs de Supabase: `function crypt(text,
   text) does not exist`. Solución: agregar `extensions` al `search_path`
   de ambas funciones (`set search_path = public, extensions`). Es
   inofensivo en un Postgres genérico donde ese esquema no existe (un
   esquema ausente en `search_path` simplemente se ignora).

Ninguno de estos puntos es una contradicción bloqueante — son huecos de
diseño que la spec deja abiertos y que hay que resolver antes de escribir
SQL. Sigo con el resto del análisis asumiendo estas decisiones; si alguna no
te convence, la cambiamos antes de la Fase 2 (todavía no se ha tocado
Supabase).

## 1. Arquitectura propuesta

```
USUARIO (navegador móvil o desktop)
   │
   ▼
REACT + TS (Vite SPA, servido estático desde GitHub Pages)
   │
   ├── Auth (admin: usuario/password interno · vendedor: anon auth + RPC seller_login)
   ├── Mapa (SVG conceptual, geometría desacoplada de datos)
   ├── Dashboard (general y por terreno, misma función parametrizada)
   ├── Lotes / Reservas / Pagos / Clientes / Vendedores / Auditoría
   │
   ▼  (PostgREST + Realtime + Auth, vía supabase-js)
SUPABASE (free tier)
   ├── Auth               → admin real, vendedores anónimos
   ├── PostgreSQL          → datos + vistas calculadas
   ├── RPC SECURITY DEFINER→ toda mutación comercial y de sesión
   ├── RLS                 → SELECT por rol, cero INSERT/UPDATE directo en tablas sensibles
   └── Realtime            → postgres_changes sobre reservations/payments filtrado por project_id
```

No hay backend propio: todo lo que en un stack tradicional sería "capa de
servicio" vive como funciones RPC dentro de Postgres. Esto es lo que permite
cumplir el objetivo de costo (S/ 0/mes, sin VPS) sin sacrificar la regla de
"no confiar solo en el cliente".

## 2. Estructura de carpetas

```
lotesd/
├── docs/
│   └── ARCHITECTURE.md
├── supabase/
│   └── migrations/              # SQL versionado (Fase 2+)
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── router.tsx
│   ├── lib/
│   │   └── supabase.ts          # cliente único, lee VITE_SUPABASE_URL/ANON_KEY
│   ├── types/
│   │   └── database.types.ts    # generado con `supabase gen types` (Fase 2+)
│   ├── features/
│   │   ├── auth/                # login admin + login vendedor
│   │   ├── sellers/             # selección de vendedor, estado en uso/disponible
│   │   ├── projects/            # listado/detalle de terrenos
│   │   ├── lots/
│   │   ├── map/                 # SVGs conceptuales + interacción
│   │   ├── clients/
│   │   ├── reservations/
│   │   ├── payments/
│   │   ├── dashboard/           # getDashboardStats(projectId?) compartido
│   │   └── audit/
│   ├── components/
│   │   ├── ui/                  # botones grandes, Bottom Sheet, cards, etc.
│   │   └── layout/               # navegación admin vs vendedor
│   ├── hooks/
│   ├── domain/                  # lógica pura compartida (cálculo de estado/color, saldo, %)
│   └── config/
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── tsconfig*.json
├── vite.config.ts
└── README.md
```

`features/` es por dominio, no por terreno — un terreno nuevo es una fila en
`projects`, no una carpeta nueva. Esto es lo que hace que la arquitectura
escale de 1 a 8 terrenos sin tocar código (spec §2, §6, §45).

## 3. Esquema inicial de base de datos (Fase 2, aún no aplicado)

```sql
-- catálogo de vendedores (10 filas fijas, nombre configurable)
sellers (
  seller_number smallint primary key check (seller_number between 1 and 10),
  display_name  text not null,
  created_at    timestamptz not null default now()
)

-- identidades reales de Supabase Auth (solo administradores en v1)
profiles (
  id           uuid primary key references auth.users(id),
  role         text not null check (role = 'admin'),
  display_name text,
  created_at   timestamptz not null default now()
)

-- exclusividad de sesión por vendedor + heartbeat
seller_sessions (
  id             uuid primary key default gen_random_uuid(),
  seller_number  smallint not null references sellers(seller_number),
  auth_user_id   uuid not null references auth.users(id),
  status         text not null default 'active' check (status in ('active','closed')),
  last_heartbeat timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
create unique index one_active_session_per_seller
  on seller_sessions (seller_number) where status = 'active';

projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
)

lots (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id),
  block           text not null,          -- 'Y', 'Z', 'K', 'L', ...
  lot_number      int not null,
  lot_code        text not null,          -- 'Y-01'
  area            numeric,
  front           numeric,
  depth           numeric,
  reference_price numeric,                -- precio comercial de referencia (no vinculante)
  geometry_id     text not null,          -- id del elemento SVG correspondiente
  created_at      timestamptz not null default now(),
  unique (project_id, lot_code)
)

clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  dni        text,
  notes      text,
  created_at timestamptz not null default now()
)

reservations (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects(id),
  lot_id              uuid not null references lots(id),
  client_id           uuid not null references clients(id),
  seller_number       smallint not null references sellers(seller_number),
  created_by_session  uuid references seller_sessions(id),
  agreed_price        numeric not null check (agreed_price > 0),
  reservation_status  text not null default 'active'
                        check (reservation_status in ('active','cancelled','completed')),
  created_at          timestamptz not null default now(),
  effective_at        timestamptz not null default now(),
  notes               text
);
create unique index one_active_reservation_per_lot
  on reservations (lot_id) where reservation_status = 'active';

payments (
  id            uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id),
  project_id    uuid not null,             -- denormalizado (ver §0.6), seteado por trigger
  amount        numeric not null check (amount > 0),
  payment_type  text not null check (payment_type in ('initial','payment')),
  created_at    timestamptz not null default now(),
  effective_at  timestamptz not null default now(),
  created_by    uuid                       -- auth.uid() de quien lo registró
)

system_settings (
  id                          boolean primary key default true check (id),  -- fila única
  seller_global_password_hash text not null,          -- nunca seleccionable por el cliente
  updated_at                  timestamptz not null default now(),
  updated_by                  uuid
)

-- estado público sin secretos (ver §0.7): la única tabla de configuración
-- que se agrega a la publicación de Realtime.
seller_access_state (
  id         boolean primary key default true check (id),
  enabled    boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid
)

audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,                        -- auth.uid(), nullable
  seller_number smallint,                   -- si la acción la hizo un vendedor
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
)
```

**Vista derivada** (estado/color siempre calculado, nunca almacenado — spec
§10, §11):

```sql
create view lot_status_view as
select
  l.*,
  r.id            as active_reservation_id,
  r.client_id,
  r.seller_number,
  r.agreed_price,
  r.effective_at  as reserved_at,
  coalesce(sum(p.amount), 0) as total_paid,
  case
    when r.id is null then 'available'
    when coalesce(sum(p.amount), 0) >= r.agreed_price then 'paid'
    else 'reserved'
  end as status
from lots l
left join reservations r
  on r.lot_id = l.id and r.reservation_status = 'active'
left join payments p
  on p.reservation_id = r.id
group by l.id, r.id;
```

`getDashboardStats(projectId?)` (spec §25) se implementa como una única
consulta/función que agrega sobre `lot_status_view` con un `WHERE project_id
= $1` opcional — dashboard general y por terreno comparten la misma función,
solo cambia el parámetro.

## 4. Flujo de autenticación

- **Administrador:** cuenta **interna**, no un correo real — el admin ve un
  login con usuario/contraseña (`admin` / `admin123` en la demo — Supabase
  Auth exige contraseñas de al menos 6 caracteres, "admin" por sí solo no
  alcanza). Por dentro sigue siendo Supabase Auth (así se obtiene un
  `auth.uid()` real y RLS funciona igual que para cualquier tabla): el
  frontend mapea el usuario `admin` a un correo sintético fijo
  (`admin@lotesd.internal`) y llama `supabase.auth.signInWithPassword({
  email: 'admin@lotesd.internal', password })` — el usuario nunca ve ese
  correo. `profiles.role = 'admin'`. La contraseña `admin123` es el valor
  semilla de la demo; el admin la cambia luego con el flujo normal de
  cambio de contraseña de Supabase Auth (no tiene relación con la
  contraseña global de vendedores del §17, son dos cosas distintas).
  - **Importante:** esta cuenta no puede crearse con una migración SQL
    normal contra un proyecto Supabase hosteado (el service_role key nunca
    debe usarse desde el frontend, y por eso tampoco se commitea un script
    que lo use). Se crea una sola vez, a mano, desde el Dashboard de
    Supabase (Authentication → Add user, con ese correo sintético) o con un
    script local de configuración que el desarrollador corre una vez fuera
    del repo. Para desarrollo local con `supabase start`, sí se puede
    sembrar en `supabase/seed.sql` porque ahí la base corre en Docker con
    control total.
- **Vendedor:** no inicia sesión con email. Requiere que el proyecto
  Supabase tenga **Anonymous sign-ins** habilitado (Authentication →
  Providers; apagado por defecto). Al elegir "Vendedor":
  1. El cliente asegura una sesión anónima (`signInAnonymously()`, una vez
     por navegador, persistida por supabase-js) apenas se abre la pantalla
     de login de vendedor, no recién al enviar el formulario — hace falta
     para poder leer `sellers`/`seller_sessions`/`seller_access_state`
     antes de que el vendedor escriba nada.
  2. El usuario elige número de vendedor, escribe su nombre y la
     contraseña global.
  3. El cliente llama a la RPC `seller_login(seller_number, name,
     password)`. Esa función, del lado del servidor:
     - verifica `system_settings.seller_access_enabled`;
     - verifica que el nombre coincida con `sellers.display_name`;
     - compara la contraseña con el hash vía `crypt()`;
     - "repasa" sesiones abandonadas (heartbeat viejo → `closed`);
     - intenta insertar en `seller_sessions`; si ya hay una activa para ese
       número, el índice único falla y la función devuelve
       `SELLER_IN_USE`.
  4. Si todo va bien, devuelve la fila de `seller_sessions`; el cliente la
     guarda (no como única fuente de verdad — el servidor manda) y arranca
     el heartbeat.

## 5. Flujo de vendedores (selección, exclusividad, heartbeat)

- El selector de vendedores lee `seller_sessions` (SELECT abierto a
  `authenticated`) para pintar 🟢 disponible / 🔴 en uso en tiempo real
  (Realtime sobre esa tabla).
- **Bloqueo global (§18):** antes de mostrar el formulario, el cliente lee
  `seller_access_state.enabled` (tabla propia sin ningún secreto, ver §0.7)
  y se suscribe a sus cambios por Realtime. Si está bloqueado, la pantalla
  muestra "🔴 ACCESO DE VENDEDORES BLOQUEADO" y **no renderiza el campo de
  contraseña ni el botón de ingresar** — no es solo que el submit lo
  rechace, el vendedor literalmente no puede escribir la contraseña
  mientras está bloqueado. Si el admin bloquea mientras alguien ya tiene la
  pantalla de login abierta, el campo desaparece al instante por la
  suscripción Realtime. Esto es una ayuda de UX; el candado real sigue
  siendo la RPC `seller_login`, que revalida `seller_access_state` del
  lado del servidor pase lo que pase en el cliente.
- Adicionalmente, al activar el bloqueo (`admin_toggle_seller_access(false)`)
  la función cierra también las sesiones ya activas (`seller_sessions.status
  = 'closed'` para todas), no solo impide nuevos logins — "pierden acceso"
  se interpreta como corte inmediato, útil como botón de pánico (ej. pausar
  ventas por un cambio de precio). Ver §10 sobre por qué esto es
  independiente del cierre por inactividad.
- Heartbeat: `setInterval` cada ~45s llama a la RPC `seller_heartbeat(id)`
  mientras la pestaña está abierta.
- Expiración: no depende de un cron en servidor (GitHub Pages no tiene
  proceso propio). Se resuelve de forma perezosa: cualquier intento de
  `seller_login` primero marca como `closed` las sesiones con
  `last_heartbeat` de más de ~3 minutos antes de intentar reclamar el
  número. Así una sesión abandonada se libera la próxima vez que alguien
  quiera usar ese número, sin depender de pg_cron.
- Logout: RPC `seller_logout(id)` pone `status='closed'`; también se
  intenta en `beforeunload` (best-effort, no garantizado en móvil).

## 6. Flujo de reservas

1. Vendedor busca/filtra el lote en el mapa o buscador → abre Bottom Sheet.
2. Si está disponible, formulario: cliente (nuevo o existente), teléfono/DNI
   opcionales, precio acordado, inicial/adelanto, observaciones.
3. El cliente llama a una única RPC `create_reservation(...)` que, en una
   transacción:
   - crea o reutiliza el cliente;
   - inserta la reserva (`created_by_session` = la sesión activa del
     vendedor, resuelta del lado del servidor a partir de `auth.uid()`, no
     de un parámetro que el cliente podría falsear);
   - inserta el pago inicial (`payment_type='initial'`) si el monto > 0;
   - escribe `audit_logs`.
   - Si el índice único `one_active_reservation_per_lot` falla → excepción
     `LOT_ALREADY_RESERVED`, que el frontend traduce a "Este lote acaba de
     ser reservado por otro vendedor." (spec §35, caso crítico de
     concurrencia).
4. Realtime empuja el cambio; todos los clientes conectados recalculan el
   color del lote sin recargar.

## 7. Flujo de pagos

- Solo el administrador puede registrar pagos posteriores y modificar
  fechas — se hace vía RPCs separadas (`admin_register_payment`,
  `admin_update_payment`, `admin_update_effective_date`), todas
  `SECURITY DEFINER` con `role = 'admin'` verificado adentro, cada una
  escribiendo su propio `audit_logs`.
- `total_pagado`, `saldo` y `porcentaje_pagado` nunca se escriben a mano:
  siempre se derivan de `lot_status_view` (o del equivalente por reserva).
- Al llegar `total_pagado >= agreed_price`, el estado pasa a `paid`
  automáticamente (es una `CASE` en la vista, no un flag) — no existe botón
  "marcar como vendido".

## 8. Estrategia del mapa

- El mapa es un SVG conceptual (carretera en cruz, 4 manzanas, brújula fija
  a la pantalla) armado en `src/features/map/` (`DemoMap.tsx` +
  `components/BlockGrid.tsx`, que genera las 12 celdas de una manzana por
  código en vez de tener 48 `<rect>` escritos a mano), con cada lote como
  un elemento con `id="lot-{lot_code}"` — esto es exactamente
  `lots.geometry_id`. Es específico del "Proyecto Demo" (4 manzanas de 12);
  un terreno con otra distribución tendría su propio componente de mapa
  hasta que exista un importador genérico (ver más abajo).
- La geometría (SVG) y el dato comercial (estado, precio, cliente) están
  completamente separados (spec §43): `useLotStatuses` trae
  `lot_status_view` por `project_id`, y `DemoMap` solo pinta/pone
  `onClick` sobre los elementos del SVG según ese estado. Ningún dato
  comercial vive dentro del SVG.
- Preparado para planos reales (spec §44): cuando la propietaria entregue
  planos digitales, basta con generar un SVG nuevo que reutilice los mismos
  `geometry_id` (o remapear `lots.geometry_id`) — no se toca el resto de la
  app. No se construye todavía ningún importador automático de DWG/DXF.
- Zoom/pan (spec §45) usa `react-zoom-pan-pinch` (gestos táctiles de pinch
  y drag ya resueltos, en vez de reimplementarlos a mano) sobre el mismo
  SVG; a 1,600 lotes no hace falta virtualización si el SVG se mantiene
  simple (paths agregados por manzana, no por lote individual con física
  propia). Buscador y "centrar lote" quedan para cuando existan (spec §36).
- El mapa se carga con un fetch puntual de `lot_status_view` (sin
  Realtime todavía) — se actualiza al recargar o al volver a entrar. La
  suscripción en vivo a `reservations`/`payments` para que el color
  cambie sin recargar es explícitamente la Fase 15, junto con el resto de
  las pantallas que la necesitan (mismo patrón ya probado en el selector
  de vendedores de la Fase 4).

## 9. Estrategia de Realtime

- Suscripción por proyecto activo a `postgres_changes` en `reservations` y
  `payments` (`filter: project_id=eq.<id>`), y a `seller_sessions` (sin
  filtro, son solo 10 filas) para el selector de vendedores.
- En vez de recomputar agregados pesados en cada evento, el cliente
  mantiene un mapa en memoria `lot_id → {reservation, payments[]}`
  actualizado incrementalmente por los eventos, y aplica la misma función
  pura `computeLotStatus()` que usa la vista SQL (misma regla, expresada en
  TS para el cliente y en SQL para consultas agregadas — la regla en sí es
  trivial de mantener sincronizada: disponible / reservado / pagado según
  `total_pagado` vs `agreed_price`).
- Esto es lo que permite que el color cambie sin recargar la página (spec
  §34) y que escale razonablemente a 8 terrenos × 200 lotes sin recalcular
  agregados globales en cada pago.

## 10. Expiración por inactividad (1 hora)

Distinto del heartbeat técnico del §5 (que detecta pestañas
cerradas/crasheadas para liberar rápido el número de vendedor, ~3 min), esto
es una política de seguridad: si **admin o vendedor** no interactúan con la
app (sin click/tecla/touch/scroll) durante 60 minutos, la sesión se cierra
sola, aunque la pestaña siga abierta y el heartbeat siga "vivo".

- Un watchdog en el cliente (hook `useIdleLogout`, compartido por ambos
  roles) guarda `lastActivityAt` en memoria, actualizado por listeners
  pasivos de `pointerdown`/`keydown`/`touchstart`/`scroll`. Cada minuto
  revisa si pasó 1h desde la última interacción.
- Al cumplirse: vendedor → llama `seller_logout(session_id)` y vuelve al
  selector; admin → `supabase.auth.signOut()` y vuelve al login. Ambos casos
  escriben `audit_logs` con `action='session_expired_inactivity'`.
- Es una defensa de cliente (no hay servidor propio que la fuerce), pero es
  coherente con el resto del diseño: el heartbeat (§5) ya es la defensa de
  servidor para el caso "el dispositivo desapareció"; este mecanismo cubre
  el caso "el dispositivo sigue ahí pero el humano se fue", que es
  exactamente lo que un heartbeat automático no puede detectar por sí solo.
- El admin, al reingresar tras la sesión de Supabase Auth expirar por
  refresh-token vencido (por defecto ~1 semana en Supabase), simplemente ve
  la pantalla de login de nuevo — no requiere manejo especial adicional.

## 11. Estrategia de seguridad

- RLS habilitado en todas las tablas, deny-by-default.
- SELECT: abierto a `authenticated` (admin + vendedores anónimos) en
  `projects`, `lots`, `clients`, `reservations`, `payments`,
  `seller_sessions`, `sellers`; `audit_logs` y la columna de hash de
  `system_settings` son solo para `role='admin'` (vía `profiles`).
- INSERT/UPDATE/DELETE: en `reservations`, `payments`, `seller_sessions` y
  `system_settings` **no existe ninguna política RLS de escritura** para
  ningún rol — todo pasa por funciones `SECURITY DEFINER` con las reglas de
  negocio adentro (§0.4), incluida la regla "el vendedor no puede modificar
  pagos ni fechas históricas" (spec §31, §42): esas RPCs directamente no
  existen para el rol vendedor. `projects`, `lots`, `clients` y `sellers` sí
  tienen política de escritura directa, pero exclusiva para
  `profiles.role='admin'` (§0.4) — un vendedor autenticado nunca pasa esa
  condición.
- Invariantes críticos (un lote, una reserva activa; un número de vendedor,
  una sesión activa) se garantizan con índices únicos parciales en
  PostgreSQL, no con lógica de JavaScript (spec §35).
- Contraseña global: hash bcrypt vía `pgcrypto`, comparado solo dentro de
  una función `SECURITY DEFINER`; la columna nunca se expone por SELECT.
- `.env` solo contiene `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
  (públicos por diseño, protegidos por RLS); la `service_role key` nunca se
  usa en el frontend ni se commitea. `.env` va en `.gitignore`; se provee
  `.env.example`.
- GitHub Pages es hosting estático puro — no hay servidor propio que
  proteger, todo el perímetro de seguridad vive en Supabase.
