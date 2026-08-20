import { createBrowserRouter } from 'react-router-dom'
import { RoleSelectPage } from './features/auth/pages/RoleSelectPage'
import { AdminLoginPage } from './features/auth/pages/AdminLoginPage'
import { SellerLoginPage } from './features/auth/pages/SellerLoginPage'
import { RequireAdmin, RequireSeller } from './features/auth/ProtectedRoute'
import { AdminHomePage } from './features/dashboard/AdminHomePage'
import { SellerHomePage } from './features/sellers/SellerHomePage'

export const router = createBrowserRouter([
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
  { path: '/vendedor/login', element: <SellerLoginPage /> },
  {
    path: '/vendedor',
    element: (
      <RequireSeller>
        <SellerHomePage />
      </RequireSeller>
    ),
  },
])
