import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { login } from '../../services/auth'
import { supabase } from '../../services/supabase'
import { B } from '../../constants/theme'

export default function SuperadminLoginScreen() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const { user, signIn } = useAuth()
  const navigate = useNavigate()

  // Si ya hay sesión de superadmin, ir al panel
  useEffect(() => {
    if (user?.rol === 'superadmin') navigate('/licencias', { replace: true })
  }, [user])

  const handleSubmit = async e => {
    e.preventDefault()
    if (!email || !password) { setError('Completá todos los campos.'); return }
    setError(''); setLoading(true)
    try {
      const userData = await login(email, password)
      if (userData.rol !== 'superadmin') {
        // No es superadmin — cerrar sesión y bloquear
        await supabase.auth.signOut()
        setError('Esta cuenta no tiene acceso de superadmin.')
        return
      }
      signIn(userData)
      navigate('/licencias', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111827', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>

      {/* logo */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, background: B, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="square">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#F9FAFB', letterSpacing: '-0.02em' }}>KontarApp</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Acceso de superadmin</div>
      </div>

      {/* card */}
      <div style={{ background: '#1F2937', border: '1px solid #374151', borderTop: `3px solid ${B}`, width: '100%', maxWidth: 380, padding: '28px 24px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@empresa.com" autoComplete="email"
              style={{ width: '100%', height: 46, border: '2px solid #374151', padding: '0 14px', fontSize: 15, color: '#F9FAFB', background: '#111827', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = B}
              onBlur={e => e.target.style.borderColor = '#374151'}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', display: 'block', marginBottom: 6 }}>
              Contraseña
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete="current-password"
              style={{ width: '100%', height: 46, border: '2px solid #374151', padding: '0 14px', fontSize: 15, color: '#F9FAFB', background: '#111827', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = B}
              onBlur={e => e.target.style.borderColor = '#374151'}
            />
          </div>

          {error && (
            <div style={{ background: '#450A0A', border: '1px solid #7F1D1D', padding: '10px 14px', fontSize: 13, color: '#FCA5A5', fontWeight: 500 }}>
              ✕ {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{ marginTop: 4, width: '100%', padding: '15px 0', background: loading ? `${B}99` : B, color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, letterSpacing: '0.04em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          >
            {loading
              ? <><div className="spin" style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%' }} /> Ingresando...</>
              : 'Ingresar'
            }
          </button>
        </form>
      </div>
    </div>
  )
}
