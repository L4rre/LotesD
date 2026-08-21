# LotesD

Webapp mobile-first para administrar proyectos inmobiliarios y reservas de
lotes en tiempo real. Centraliza lo que hoy se maneja con planos y papel:
disponibilidad de lotes, reservas, clientes, pagos y vendedores, con
actualización en tiempo real entre dispositivos.

Ver el análisis completo de arquitectura, esquema de base de datos y
decisiones de diseño en [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Estado actual

**Fase 16-18** (de 22), más dos rondas de ajustes pedidos tras probar todo
en vivo. La más reciente: **el terreno real reemplazó al Proyecto Demo**
— 5 manzanas (X-10, Y-10, Y-11, Z-10, Z-11), 78 lotes, con área y
perímetro transcritos de la tabla maestra del propietario (ver
`docs/ARCHITECTURE.md` §14). Cada lote muestra área/perímetro y una
imagen individual con sus cotas en vez de los lados como texto — para que
la imagen de un lote aparezca automáticamente, solo hay que dejarla en
`public/lot-details/<manzana-sin-guion>-<lote>.png` (ej.
`public/lot-details/X10-05.png`); si todavía no existe, la ficha avisa
"Imagen de dimensiones no disponible" sin romperse. El mapa (calles,
parque, las 5 manzanas) se genera desde datos, no es un dibujo fijo —
agregar otro terreno más adelante es un archivo de layout nuevo en
`src/features/map/terrainData/`, no un componente nuevo.

Antes de eso: **la página de inicio (`/`) es pública** — cualquier
visitante ve el mapa del terreno (disponibilidad + dimensiones al hacer
clic) sin iniciar sesión, con dos botones "Administrador" / "Vendedor"
que abren el login como ventana modal sobre el mismo mapa; una vez
logeado, el encabezado cambia según el rol y aparece "Cerrar sesión" (ver
`docs/ARCHITECTURE.md` §4, §13). Solo el admin puede editar el área/
perímetro de un lote. Los formularios de reserva y pago guardan un
borrador en el navegador mientras se escriben, para no perder lo ya
escrito si se cierra la app a medias. El admin tiene un **dashboard
general** (`/admin`) y un
**dashboard por terreno** (`/terrenos/:id/dashboard`), ambos con conteos
por estado, valor reservado/cobrado/saldo, tabla por vendedor y listas de
recientes — comparten un mismo hook y componente (spec §25, ver
`docs/ARCHITECTURE.md` §12). Cada vendedor tiene su propia sección **"Mi
actividad"** (`/vendedor`) con solo sus propias reservas y clientes, nunca
los de otro vendedor (spec §49/§51). Ver `docs/ARCHITECTURE.md` §0.7-§0.8
por dos correcciones de fases anteriores (Realtime filtrando el hash de
la contraseña; pgcrypto en el esquema `extensions` de Supabase). Falta:
auditoría (Fase 19), cancelación de reservas, historial por lote y el
resto.

**Para probar el login real** necesitas un proyecto Supabase con las
migraciones aplicadas — ver la sección [Base de datos](#base-de-datos-supabase)
más abajo. Sin `.env` configurado, la app carga igual pero cualquier
intento de login muestra "No se pudo conectar" (falla de red esperada, no
un error de código).

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Supabase (PostgreSQL, Auth, Realtime, Row Level Security)
- Mapa: SVG conceptual e interactivo (sin planos reales todavía)
- Hosting: GitHub Pages (gratuito)

## Requisitos

- Node.js 20+
- Una cuenta de Supabase (plan Free) — se configurará en la Fase 2

## Cómo ejecutar

```bash
npm install
cp .env.example .env   # completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY cuando existan
npm run dev
```

La app queda disponible en `http://localhost:5173`. Mientras no exista un
proyecto Supabase configurado, la app funciona igual (solo se muestra una
advertencia en consola).

## Scripts

| Comando           | Descripción                          |
| ----------------- | ------------------------------------- |
| `npm run dev`      | Servidor de desarrollo con HMR        |
| `npm run build`     | Type-check + build de producción      |
| `npm run preview`   | Sirve el build de producción localmente |
| `npm run lint`      | Lint con oxlint                       |

## Estructura del proyecto

```
src/
├── lib/          # cliente de Supabase, utilidades de infraestructura
├── types/        # tipos generados/manuales de la base de datos
├── features/     # un módulo por dominio (auth, sellers, lots, map, reservations, payments, dashboard, ...)
├── components/   # componentes de UI reutilizables (ui/, layout/)
├── domain/       # lógica de negocio pura (cálculo de estado/color, saldo, %)
├── hooks/        # hooks de React compartidos
└── config/       # constantes y configuración de la app
```

Un terreno nuevo es una fila en la tabla `projects`, no una carpeta nueva:
la arquitectura está pensada para escalar de 1 a 8 terrenos (~1,600 lotes)
sin duplicar código.

## Base de datos (Supabase)

El esquema vive como SQL versionado en `supabase/migrations/` (se aplican en
orden por nombre de archivo). Cubre: catálogo de vendedores, proyectos,
lotes, clientes, reservas, pagos, sesiones de vendedor, configuración
global y auditoría — con RLS y funciones `SECURITY DEFINER` para toda
mutación sensible (ver `docs/ARCHITECTURE.md` §0, §11).

**Aplicar en un proyecto Supabase (hosted, plan Free):**

1. Crea el proyecto en [supabase.com](https://supabase.com).
2. En Authentication → Sign In / Providers, habilita **Anonymous sign-ins**
   (apagado por defecto). La home pública y el login de vendedor lo
   necesitan — ver `docs/ARCHITECTURE.md` §4.
3. En el SQL Editor del dashboard, corre cada archivo de
   `supabase/migrations/` en orden (o usa `supabase db push` con el CLI si
   lo prefieres).
4. Copia `.env.example` a `.env` y completa `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
5. Crea la cuenta interna del administrador (no es un correo real, ver
   `docs/ARCHITECTURE.md` §4):
   ```bash
   SUPABASE_URL=https://tu-proyecto.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key \
   ADMIN_PASSWORD=admin123 \
   node scripts/create-admin.mjs
   ```
   La `service_role key` solo se usa acá, en tu terminal, una sola vez —
   nunca en el frontend ni commiteada. Supabase Auth exige contraseñas de
   al menos 6 caracteres (por eso `admin123`, no `admin`). Cambia
   `ADMIN_PASSWORD` antes de usar la app con datos reales.

**Probar el esquema localmente (sin necesidad de un proyecto Supabase):**
requiere PostgreSQL instalado. `scripts/test/00_auth_stub.sql` simula lo
justo del esquema `auth` de Supabase (roles, `auth.users`, `auth.uid()`)
para poder aplicar las migraciones y correr
`scripts/test/01_smoke.sql`, que ejercita los casos críticos del §55 de la
especificación (doble sesión de vendedor, doble reserva concurrente,
sobrepago, RLS, bloqueo global, cálculo automático de estado/saldo):

```bash
createdb lotesd_test
psql -d lotesd_test -f scripts/test/00_auth_stub.sql
for f in supabase/migrations/*.sql; do psql -d lotesd_test -f "$f"; done
psql -d lotesd_test -f scripts/test/01_smoke.sql
dropdb lotesd_test
```

## Seguridad y costos

- La `anon key` de Supabase es pública por diseño; la seguridad real vive en
  las políticas RLS y en funciones RPC del lado del servidor (nunca se usa
  la `service_role key` en el frontend).
- `.env` nunca se sube a git (ver `.gitignore`); usa `.env.example` como
  plantilla.
- Objetivo de costo: S/ 0/mes usando GitHub Pages + Supabase Free.
