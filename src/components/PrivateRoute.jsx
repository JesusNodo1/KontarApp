import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function PrivateRoute({ children, requiredRole }) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  if (requiredRole && user.rol !== requiredRole) {
    return <Navigate to={user.rol === 'admin' ? '/admin' : '/contador'} replace />
  }

  return children
}
