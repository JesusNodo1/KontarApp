import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { B, BL } from '../../constants/theme'

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/soporte-data`

function _getToken() {
  const key = `sb-${import.meta.env.VITE_SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`
  try { return JSON.parse(localStorage.getItem(key) || '{}').access_token || null } catch { return null }
}

async function fetchClientes() {
  const token = _getToken()
  const res = await fetch(`${EDGE_URL}?action=clientes`, {
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json
}

export default function SoporteSelectScreen() {
  const [clientes, setClientes] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const { user, signIn } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user || user.rol !== 'soporte') { navigate('/login', { replace: true }); return }
    fetchClientes()
      .then(data => {
        setClientes(data)
        if (data.length === 1) {
          signIn({ ...user, cliente_id: data[0].cliente_id })
          navigate('/soporte', { replace: true })
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const seleccionar = (sc) => {
    signIn({ ...user, cliente_id: sc.cliente_id })
    navigate('/soporte', { replace: true })
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spin" style={{ width: 28, height: 28, border: '3px solid #E5E7EB', borderTopColor: B, borderRadius: '50%' }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, background: B, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="square">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Seleccioná un cliente</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Hola, {user?.nombre} — ¿A qué empresa querés acceder?</div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 16, width: '100%', maxWidth: 480 }}>
          ✕ {error}
        </div>
      )}

      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {clientes.length === 0 && !error && (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', padding: '32px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
            No tenés clientes asignados.
          </div>
        )}
        {clientes.map(sc => (
          <button
            key={sc.cliente_id}
            onClick={() => seleccionar(sc)}
            style={{ background: '#fff', border: '1px solid #E5E7EB', borderLeft: `4px solid ${B}`, padding: '16px 20px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background .15s' }}
            onMouseEnter={e => e.currentTarget.style.background = BL}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{sc.nombre_empresa}</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>ID #{sc.cliente_id}</div>
            </div>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth="2.2" strokeLinecap="square">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}
