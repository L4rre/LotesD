# LotesD

Webapp mobile-first para administrar proyectos inmobiliarios y reservas de
lotes en tiempo real. Centraliza lo que hoy se maneja con planos y papel:
disponibilidad de lotes, reservas, clientes, pagos y vendedores, con
actualización en tiempo real entre dispositivos.

Ver el análisis completo de arquitectura, esquema de base de datos y
decisiones de diseño en [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Estado actual

**Fase 2** (de 22) — base de datos: esquema completo en
`supabase/migrations/` (tablas, relaciones, RLS, funciones RPC) validado
contra un Postgres real (ver [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
para el detalle de cada decisión). Todavía no hay UI conectada a Supabase —
eso empieza en la Fase 3 (autenticación).

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
2. En el SQL Editor del dashboard, corre cada archivo de
   `supabase/migrations/` en orden (o usa `supabase db push` con el CLI si
   lo prefieres).
3. Copia `.env.example` a `.env` y completa `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
4. Crea la cuenta interna del administrador (no es un correo real, ver
   `docs/ARCHITECTURE.md` §4):
   ```bash
   SUPABASE_URL=https://tu-proyecto.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key \
   ADMIN_PASSWORD=admin \
   node scripts/create-admin.mjs
   ```
   La `service_role key` solo se usa acá, en tu terminal, una sola vez —
   nunca en el frontend ni commiteada. Cambia `ADMIN_PASSWORD` antes de
   usar la app con datos reales.

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
