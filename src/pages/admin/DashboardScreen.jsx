import { useEffect, useState } from 'react'
import { B, BL, G, GL } from '../../constants/theme'
import { getDashboardData } from '../../services/adminService'
import { fmtFecha } from '../../services/conteoService'

export default function DashboardScreen() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboardData().then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
      <div className="spin" style={{ width: 24, height: 24, border: '3px solid #E5E7EB', borderTopColor: B, borderRadius: '50%' }} />
    </div>
  )

  const { totalProductos, totalUsuarios, inv, contados, totalZonas, zonasOk, actividad } = data || {}

  const STATS = [
    { label: 'Productos', value: totalProductos, sub: 'en catálogo', color: B, bg: BL,
      icon: <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1={12} y1="22.08" x2={12} y2={12}/></svg> },
    { label: 'Usuarios', value: totalUsuarios, sub: 'en el sistema', color: B, bg: BL,
      icon: <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx={9} cy={7} r={4}/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
    { label: 'Contados', value: inv ? contados : '—', sub: 'en inventario activo', color: G, bg: GL,
      icon: <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square"><path d="M20 6L9 17l-5-5"/></svg> },
    { label: 'Zonas OK', value: inv ? `${zonasOk}/${totalZonas}` : '—', sub: 'finalizadas', color: G, bg: GL,
      icon: <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square"><rect x={3} y={3} width={18} height={18}/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg> },
  ]

  return (
    <div style={{ padding: '24px 20px', maxWidth: 960, margin: '0 auto' }}>

      {/* inventario activo */}
      {inv ? (
        <div style={{ background: B, padding: '18px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)', marginBottom: 4 }}>Inventario activo</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{inv.nombre}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.8)', marginTop: 2 }}>
              {inv.sucursal}{inv.fecha_inicio ? ` · ${fmtFecha(inv.fecha_inicio)} → ${fmtFecha(inv.fecha_limite)}` : ''}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', padding: '6px 14px', fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            ABIERTO
          </div>
        </div>
      ) : (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', padding: '18px 20px', marginBottom: 24, fontSize: 14, color: '#6B7280' }}>
          No hay inventario activo. Creá uno desde la sección <strong>Inventarios</strong>.
        </div>
      )}

      {/* stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {STATS.map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #E5E7EB', padding: '16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 26, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF' }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* actividad reciente */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Actividad reciente</div>
        </div>
        {actividad.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>Sin actividad registrada aún.</div>
        ) : actividad.map((a, i) => (
          <div key={i} style={{ padding: '13px 16px', borderBottom: i < actividad.length - 1 ? '1px solid #F3F4F6' : 'none', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ width: 36, height: 36, background: BL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: B }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx={12} cy={7} r={4}/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{a.usuario?.nombre || '—'}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{a.zona?.nombre || '—'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: B }}>{a.cantidad} uds.</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                {new Date(a.updated_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
