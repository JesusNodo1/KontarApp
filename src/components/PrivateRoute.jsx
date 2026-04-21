import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function PrivateRoute({ children, requiredRole }) {
  const { user } = useAuth()

  if (!user) {
    const dest = requiredRole === 'superadmin' ? '/licencias/login' : '/login'
    return <Navigate to={dest} replace />
  }

  if (requiredRole && user.rol !== requiredRole) {
    if (user.rol === 'admin')       return <Navigate to="/admin"    replace />
    if (user.rol === 'superadmin')  return <Navigate to="/licencias" replace />
    if (user.rol === 'soporte')     return <Navigate to={user.cliente_id ? '/soporte' : '/soporte/select'} replace />
    return <Navigate to="/contador" replace />
  }

  return children
}
