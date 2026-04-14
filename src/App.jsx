import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute     from './components/PrivateRoute'

import TerminalGate     from './pages/auth/TerminalGate'
import ActivacionScreen from './pages/auth/ActivacionScreen'
import LoginScreen      from './pages/auth/LoginScreen'
import CounterApp       from './pages/counter/CounterApp'
import AdminLayout      from './pages/admin/AdminLayout'
import DashboardScreen  from './pages/admin/DashboardScreen'
import ProductosScreen  from './pages/admin/ProductosScreen'
import UsuariosScreen   from './pages/admin/UsuariosScreen'
import InventariosScreen from './pages/admin/InventariosScreen'
import SuperadminLayout  from './pages/superadmin/SuperadminLayout'
import LicenciasScreen   from './pages/superadmin/LicenciasScreen'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Entrada: verifica si el terminal está activado */}
          <Route path="/" element={<TerminalGate />} />

          {/* Activación (pública, antes del login) */}
          <Route path="/activate" element={<ActivacionScreen />} />

          {/* Login */}
          <Route path="/login" element={<LoginScreen />} />

          {/* Contador */}
          <Route
            path="/contador"
            element={
              <PrivateRoute requiredRole="contador">
                <CounterApp />
              </PrivateRoute>
            }
          />

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <PrivateRoute requiredRole="admin">
                <AdminLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard"   element={<DashboardScreen />} />
            <Route path="productos"   element={<ProductosScreen />} />
            <Route path="usuarios"    element={<UsuariosScreen />} />
            <Route path="inventarios" element={<InventariosScreen />} />
          </Route>

          {/* Superadmin */}
          <Route
            path="/licencias"
            element={
              <PrivateRoute requiredRole="superadmin">
                <SuperadminLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<LicenciasScreen />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
