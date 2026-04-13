import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { checkTerminal, getDeviceId } from '../../services/auth'
import { B } from '../../constants/theme'

/**
 * Pantalla de entrada: verifica si el terminal está activado.
 * - Si ya está en la DB → redirige a /login
 * - Si no → redirige a /activate
 */
export default function TerminalGate() {
  const [status, setStatus] = useState('checking') // 'checking' | 'registered' | 'unregistered'

  useEffect(() => {
    // Asegurar que el device_id exista antes de verificar
    getDeviceId()
    checkTerminal()
      .then(registered => setStatus(registered ? 'registered' : 'unregistered'))
      .catch(() => setStatus('unregistered'))
  }, [])

  if (status === 'checking') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3F4F6' }}>
        <div className="spin" style={{ width: 28, height: 28, border: '3px solid #E5E7EB', borderTopColor: B, borderRadius: '50%' }} />
      </div>
    )
  }

  if (status === 'registered') return <Navigate to="/login" replace />
  return <Navigate to="/activate" replace />
}
