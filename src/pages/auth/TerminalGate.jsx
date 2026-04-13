import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { checkTerminal, getDeviceId } from '../../services/auth'
import { useAuth } from '../../context/AuthContext'
import { B } from '../../constants/theme'

export default function TerminalGate() {
  const [status, setStatus] = useState('checking')
  const { user } = useAuth()

  useEffect(() => {
    getDeviceId()
    checkTerminal()
      .then(registered => {
        if (!registered) { setStatus('unregistered'); return }
        // Terminal registrada → si ya hay sesión, ir directo a la app
        if (user) {
          setStatus(user.rol === 'admin' ? 'admin' : 'contador')
        } else {
          setStatus('registered')
        }
      })
      .catch(() => setStatus('unregistered'))
  }, [user])

  if (status === 'checking') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3F4F6' }}>
        <div className="spin" style={{ width: 28, height: 28, border: '3px solid #E5E7EB', borderTopColor: B, borderRadius: '50%' }} />
      </div>
    )
  }

  if (status === 'admin')    return <Navigate to="/admin"    replace />
  if (status === 'contador') return <Navigate to="/contador" replace />
  if (status === 'registered') return <Navigate to="/login"  replace />
  return <Navigate to="/activate" replace />
}
