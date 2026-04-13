import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { activarTerminal, getDeviceId } from '../../services/auth'
import { useAuth } from '../../context/AuthContext'
import { B, BL, G } from '../../constants/theme'

export default function ActivacionScreen() {
  const [codigo,  setCodigo]  = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const { user } = useAuth()
  const navigate = useNavigate()
  const deviceId = getDeviceId()

  const handleActivar = async e => {
    e.preventDefault()
    if (!codigo.trim()) { setError('Ingresá el código de licencia.'); return }
    setError(''); setLoading(true)
    try {
      await activarTerminal(codigo)
      // Si ya hay sesión, ir directo a la app; si no, al login
      if (user) {
        navigate(user.rol === 'admin' ? '/admin' : '/contador', { replace: true })
      } else {
        navigate('/login', { replace: true })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>

      {/* logo */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, background: B, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="square">
            <rect x={3} y={11} width={18} height={11} rx={0}/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Activación de terminal</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Habilitá este dispositivo para usar KontarApp</div>
      </div>

      {/* card */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderTop: `3px solid ${B}`, width: '100%', maxWidth: 400, padding: '28px 24px' }}>
        <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, marginBottom: 20 }}>
          Este dispositivo no está habilitado. Ingresá el <strong>código de licencia</strong> para activarlo.
          Esto también ocurre si se limpió el caché del navegador.
        </p>

        {/* device id */}
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', padding: '10px 14px', marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 4 }}>ID de terminal</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#374151', wordBreak: 'break-all' }}>{deviceId}</div>
        </div>

        <form onSubmit={handleActivar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', display: 'block', marginBottom: 6 }}>
              Código de licencia
            </label>
            <input
              type="text" value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ej: XXXX-XXXX" autoComplete="off" spellCheck={false}
              style={{ width: '100%', height: 52, border: '2px solid #E5E7EB', padding: '0 14px', fontSize: 18, color: '#111827', background: '#F9FAFB', fontFamily: "'DM Mono',monospace", letterSpacing: '0.1em', textAlign: 'center' }}
              onFocus={e => e.target.style.borderColor = B}
              onBlur={e => e.target.style.borderColor = '#E5E7EB'}
            />
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', fontSize: 13, color: '#DC2626', fontWeight: 500 }}>
              ✕ {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{ width: '100%', padding: '15px 0', background: loading ? `${G}99` : G, color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, letterSpacing: '0.04em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          >
            {loading
              ? <><div className="spin" style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%' }} /> Validando...</>
              : <>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"><path d="M20 6L9 17l-5-5"/></svg>
                  Activar terminal
                </>
            }
          </button>
        </form>

        {/* demo hint */}
        <div style={{ marginTop: 16, padding: '10px 12px', background: BL, border: `1px solid ${B}33`, fontSize: 12, color: '#374151' }}>
          <strong style={{ color: B }}>Demo:</strong> código de licencia → <strong style={{ fontFamily: "'DM Mono',monospace" }}>DEMO-2025</strong>
        </div>
      </div>
    </div>
  )
}
