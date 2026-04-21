import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { B, BL, G, GL } from '../../constants/theme'

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/soporte-data`

function _getToken() {
  const key = `sb-${import.meta.env.VITE_SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`
  try { return JSON.parse(localStorage.getItem(key) || '{}').access_token || null } catch { return null }
}

async function fetchDashboard(clienteId) {
  const token = _getToken()
  const res = await fetch(`${EDGE_URL}?cliente_id=${clienteId}`, {
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json
}

function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function Spin({ size = 22 }) {
  return <div className="spin" style={{ width: size, height: size, border: `2.5px solid #E5E7EB`, borderTopColor: B, borderRadius: '50%' }} />
}

export default function SoporteScreen() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const load = useCallback(async () => {
    if (!user?.cliente_id) { navigate('/soporte/select', { replace: true }); return }
    setLoading(true); setError('')
    try { setData(await fetchDashboard(user.cliente_id)) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [user?.cliente_id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Spin size={28} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '28px 24px' }}>
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '12px 16px', color: '#DC2626', fontSize: 13 }}>✕ {error}</div>
      </div>
    )
  }

  const { inv, zonas = [], actividad = [], totalConteos = 0 } = data || {}
  const zonasOk  = zonas.filter(z => z.finalizada).length
  const progreso = zonas.length > 0 ? Math.round((zonasOk / zonas.length) * 100) : 0

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Dashboard</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Vista de solo lectura</div>
      </div>

      {!inv && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
          No hay inventario activo para este cliente.
        </div>
      )}

      {inv && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderTop: `3px solid ${B}` }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>{inv.nombre}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                  {inv.sucursal} · Depósito: {inv.deposito || '—'} · Inicio: {fmtFecha(inv.fecha_inicio)}
                </div>
              </div>
              <span style={{ padding: '4px 12px', background: GL, color: '#059669', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Abierto
              </span>
            </div>

            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Conteos',       value: totalConteos },
                  { label: 'Zonas totales', value: zonas.length },
                  { label: 'Zonas OK',      value: zonasOk },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>{value}</div>
                  </div>
                ))}
              </div>

              {zonas.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', marginBottom: 6 }}>
                    <span>Progreso de zonas</span>
                    <span style={{ fontWeight: 700, color: B }}>{progreso}%</span>
                  </div>
                  <div style={{ height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progreso}%`, background: B, transition: 'width .3s' }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {zonas.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, fontSize: 14, color: '#111827' }}>
                Zonas ({zonas.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', padding: '8px 16px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                {['Nombre', 'Estado'].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF' }}>{h}</div>
                ))}
              </div>
              {zonas.map((z, i) => (
                <div key={z.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px', padding: '10px 16px', borderBottom: i < zonas.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{z.nombre}</div>
                  <div>
                    <span style={{
                      padding: '3px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                      background: z.finalizada ? GL : '#F3F4F6',
                      color:      z.finalizada ? '#059669' : '#9CA3AF',
                    }}>
                      {z.finalizada ? 'Lista' : 'Pendiente'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {actividad.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, fontSize: 14, color: '#111827' }}>
                Actividad reciente
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 60px', padding: '8px 16px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                {['Producto', 'Zona', 'Usuario', 'Cant.'].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF' }}>{h}</div>
                ))}
              </div>
              {actividad.map((a, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 60px', padding: '9px 16px', borderBottom: i < actividad.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.producto?.nombre || '—'}</div>
                    {a.producto?.sku && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{a.producto.sku}</div>}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.zona?.nombre || '—'}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.usuario?.nombre || '—'}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: B }}>{a.cantidad}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
