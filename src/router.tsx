import { createHashRouter } from 'react-router-dom'
import { HomePage } from './features/home/HomePage'
import { RequireAdmin, RequireSeller } from './features/auth/ProtectedRoute'
import { AdminHomePage } from './features/dashboard/AdminHomePage'
import { SellerHomePage } from './features/sellers/SellerHomePage'
import { AdminSellersPage } from './features/sellers/pages/AdminSellersPage'
import { ProjectsListPage } from './features/projects/pages/ProjectsListPage'
import { ProjectDetailPage } from './features/projects/pages/ProjectDetailPage'
import { ProjectDashboardPage } from './features/dashboard/pages/ProjectDashboardPage'

// HashRouter (URLs con #) en vez de BrowserRouter: GitHub Pages es hosting
// estático puro, sin reglas de rewrite del lado del servidor — con rutas
// "normales" recargar /admin daría 404. Con hash (/#/admin) todo se
// resuelve en el cliente sin depender del servidor. Ver docs §Deployment.
//
// "/" es pública (cualquier visitante ve disponibilidad y dimensiones sin
// sesión); el login vive como Bottom Sheet dentro de HomePage, no como
// ruta propia. "/terrenos" y "/terrenos/:projectId" también son públicas
// por la misma razón. El resto exige el rol correspondiente.
export const router = createHashRouter([
  { path: '/', element: <HomePage /> },
  {
    path: '/admin',
    element: (
      <RequireAdmin>
        <AdminHomePage />
      </RequireAdmin>
    ),
  },
  {
    path: '/admin/vendedores',
    element: (
      <RequireAdmin>
        <AdminSellersPage />
      </RequireAdmin>
    ),
  },
  {
    path: '/vendedor',
    element: (
      <RequireSeller>
        <SellerHomePage />
      </RequireSeller>
    ),
  },
  { path: '/terrenos', element: <ProjectsListPage /> },
  { path: '/terrenos/:projectId', element: <ProjectDetailPage /> },
  {
    path: '/terrenos/:projectId/dashboard',
    element: (
      <RequireAdmin>
        <ProjectDashboardPage />
      </RequireAdmin>
    ),
  },
])
