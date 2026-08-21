import { createHashRouter } from 'react-router-dom'
import { RoleSelectPage } from './features/auth/pages/RoleSelectPage'
import { AdminLoginPage } from './features/auth/pages/AdminLoginPage'
import { SellerLoginPage } from './features/auth/pages/SellerLoginPage'
import { RequireAdmin, RequireAnyRole, RequireSeller } from './features/auth/ProtectedRoute'
import { AdminHomePage } from './features/dashboard/AdminHomePage'
import { SellerHomePage } from './features/sellers/SellerHomePage'
import { AdminSellersPage } from './features/sellers/pages/AdminSellersPage'
import { ProjectsListPage } from './features/projects/pages/ProjectsListPage'
import { ProjectDetailPage } from './features/projects/pages/ProjectDetailPage'

// HashRouter (URLs con #) en vez de BrowserRouter: GitHub Pages es hosting
// estático puro, sin reglas de rewrite del lado del servidor — con rutas
// "normales" recargar /admin daría 404. Con hash (/#/admin) todo se
// resuelve en el cliente sin depender del servidor. Ver docs §Deployment.
export const router = createHashRouter([
  { path: '/', element: <RoleSelectPage /> },
  { path: '/admin/login', element: <AdminLoginPage /> },
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
  { path: '/vendedor/login', element: <SellerLoginPage /> },
  {
    path: '/vendedor',
    element: (
      <RequireSeller>
        <SellerHomePage />
      </RequireSeller>
    ),
  },
  {
    path: '/terrenos',
    element: (
      <RequireAnyRole>
        <ProjectsListPage />
      </RequireAnyRole>
    ),
  },
  {
    path: '/terrenos/:projectId',
    element: (
      <RequireAnyRole>
        <ProjectDetailPage />
      </RequireAnyRole>
    ),
  },
])
