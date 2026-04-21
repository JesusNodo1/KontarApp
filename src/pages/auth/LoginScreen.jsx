import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { login, checkTerminal } from '../../services/auth'
import { B, BL, G } from '../../constants/theme'

export default function LoginScreen() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const { user, signIn } = useAuth()
  const navigate = useNavigate()

  const destino = rol => rol === 'admin' ? '/admin' : '/contador'

  // Redirigir si ya hay sesión activa (solo admin/contador)
  useEffect(() => {
    if (user && user.rol !== 'superadmin') navigate(destino(user.rol), { replace: true })
  }, [user])

  const handleSubmit = async e => {
    e.preventDefault()
    if (!email || !password) { setError('Completá todos los campos.'); return }
    setError(''); setLoading(true)
    try {
      const userData = await login(email, password)
      if (userData.rol === 'superadmin') {
        // Superadmin no puede acceder por aquí — cerrar sesión
        await import('../../services/supabase').then(m => m.supabase.auth.signOut())
        setError('Esta cuenta es de superadmin. Ingresá desde /licencias')
        return
      }
      if (userData.rol === 'soporte') {
        signIn(userData)
        navigate('/soporte/select', { replace: true }); return
      }
      signIn(userData)
      const activo = await checkTerminal()
      navigate(activo ? destino(userData.rol) : '/activate', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>

      {/* logo / marca */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, background: B, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="square">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1={12} y1="22.08" x2={12} y2={12}/>
          </svg>
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>KontarApp</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Sistema de conteo de inventario</div>
      </div>

      {/* card */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderTop: `3px solid ${B}`, width: '100%', maxWidth: 400, padding: '28px 24px' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 24 }}>Iniciar sesión</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* email */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="usuario@empresa.com" autoComplete="email"
              style={{ width: '100%', height: 46, border: '2px solid #E5E7EB', padding: '0 14px', fontSize: 15, color: '#111827', background: '#F9FAFB' }}
              onFocus={e => e.target.style.borderColor = B}
              onBlur={e => e.target.style.borderColor = '#E5E7EB'}
            />
          </div>

          {/* password */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', display: 'block', marginBottom: 6 }}>
              Contraseña
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete="current-password"
              style={{ width: '100%', height: 46, border: '2px solid #E5E7EB', padding: '0 14px', fontSize: 15, color: '#111827', background: '#F9FAFB' }}
              onFocus={e => e.target.style.borderColor = B}
              onBlur={e => e.target.style.borderColor = '#E5E7EB'}
            />
          </div>

          {/* error */}
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', fontSize: 13, color: '#DC2626', fontWeight: 500 }}>
              ✕ {error}
            </div>
          )}

          {/* submit */}
          <button
            type="submit" disabled={loading}
            style={{ marginTop: 8, width: '100%', padding: '15px 0', background: loading ? `${B}99` : B, color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, letterSpacing: '0.04em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          >
            {loading
              ? <><div className="spin" style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%' }} /> Ingresando...</>
              : 'Ingresar'
            }
          </button>
        </form>

        {/* demo hint */}
        <div style={{ marginTop: 20, padding: '10px 12px', background: BL, border: `1px solid ${B}33`, fontSize: 12, color: '#374151' }}>
          <strong style={{ color: B }}>Demo:</strong> admin@demo.com / contador@demo.com — contraseña: <strong>1234</strong>
        </div>
      </div>

      <div style={{ marginTop: 24, fontSize: 12, color: '#9CA3AF' }}>
        ¿Problemas para ingresar? Contactá a tu distribuidor.
      </div>
    </div>
  )
}
