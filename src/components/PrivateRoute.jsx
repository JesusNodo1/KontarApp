import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function PrivateRoute({ children, requiredRole }) {
  const { user } = useAuth()

  if (!user) {
    const dest = requiredRole === 'superadmin' ? '/licencias/login' : '/login'
    return <Navigate to={dest} replace />
  }

  if (requiredRole && user.rol !== requiredRole) {
    const dest = user.rol === 'admin' ? '/admin' : user.rol === 'superadmin' ? '/licencias' : '/contador'
    return <Navigate to={dest} replace />
  }

  return children
}
