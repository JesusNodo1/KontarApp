import { useEffect, useMemo, useState } from 'react'
import { B, BL, G, GL } from '../../../constants/theme'
import { getReporteHistorico, exportToXlsx } from '../../../services/reportService'
import { fmtFecha } from '../../../services/conteoService'
import Spinner from '../../../components/Spinner'

const normalize = s => (s || '').toString().toLowerCase().trim()

export default function ReporteHistorico({ deposito }) {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [q,       setQ]       = useState('')
  const [responsable, setResponsable] = useState('')
  const [desde,   setDesde]   = useState('')
  const [hasta,   setHasta]   = useState('')

  useEffect(() => {
    if (!deposito) { setRows([]); return }
    setLoading(true); setError(''); setRows([])
    getReporteHistorico(deposito.id)
      .then(setRows)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [deposito?.id])

  const responsables = useMemo(() => {
    const set = new Set()
    for (const r of rows) { if (r.responsable) set.add(r.responsable) }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [rows])

  const filtradas = useMemo(() => {
    const n = normalize(q)
    const desdeMs = desde ? new Date(desde + 'T00:00:00').getTime() : null
    const hastaMs = hasta ? new Date(hasta + 'T23:59:59').getTime() : null
    return rows.filter(r => {
      if (responsable && r.responsable !== responsable) return false
      if (desdeMs || hastaMs) {
        const t = r.fecha_inicio ? new Date(r.fecha_inicio).getTime() : NaN
        if (Number.isNaN(t)) return false
        if (desdeMs && t < desdeMs) return false
        if (hastaMs && t > hastaMs) return false
      }
      if (!n) return true
      return normalize(r.nombre).includes(n) || normalize(r.responsable).includes(n)
    })
  }, [rows, q, responsable, desde, hasta])

  const hayFiltros = q || responsable || desde || hasta
  const limpiar = () => { setQ(''); setResponsable(''); setDesde(''); setHasta('') }

  const handleExport = () => {
    if (filtradas.length === 0) return
    const rowsX = filtradas.map(r => ({
      inventario:   r.nombre,
      fecha_inicio: fmtFecha(r.fecha_inicio) || '',
      fecha_limite: fmtFecha(r.fecha_limite) || '',
      responsable:  r.responsable || '',
      zonas:        r.zonas,
      productos:    r.productos,
      unidades:     r.unidades,
    }))
    exportToXlsx(
      rowsX,
      [
        { key: 'inventario',   label: 'Inventario' },
        { key: 'fecha_inicio', label: 'Fecha inicio' },
        { key: 'fecha_limite', label: 'Fecha límite' },
        { key: 'responsable',  label: 'Responsable' },
        { key: 'zonas',        label: 'Zonas' },
        { key: 'productos',    label: 'Productos contados' },
        { key: 'unidades',     label: 'Unidades totales' },
      ],
      `historico_${deposito.nombre || 'deposito'}`.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase(),
      'Histórico',
    )
  }

  if (!deposito) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 14, background: '#fff', border: '1px solid #E5E7EB' }}>
        Seleccioná un depósito para ver su histórico de inventarios cerrados.
      </div>
    )
  }

  // Promedio de unidades calculado sobre lo filtrado
  const promedio = filtradas.length > 0 ? Math.round(filtradas.reduce((s, r) => s + r.unidades, 0) / filtradas.length) : 0

  return (
    <div>
      {/* toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, fontSize: 13, color: '#6B7280', minWidth: 200 }}>
          Inventarios cerrados de <strong style={{ color: '#111827' }}>{deposito.nombre}</strong>
        </div>
        <button
          onClick={handleExport}
          disabled={loading || filtradas.length === 0}
          style={{ padding: '0 18px', height: 42, background: filtradas.length === 0 || loading ? '#E5E7EB' : G, border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: filtradas.length === 0 || loading ? 'not-allowed' : 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1={12} y1={15} x2={12} y2={3}/></svg>
          Exportar Excel
        </button>
      </div>

      {/* filtros: buscador / responsable / fechas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><circle cx={11} cy={11} r={7}/><path d="M21 21l-4.35-4.35"/></svg>
          </span>
          <input
            value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar inventario o responsable..." autoComplete="off"
            style={{ width: '100%', height: 38, border: '2px solid #E5E7EB', paddingLeft: 34, paddingRight: 12, fontSize: 13, color: '#111827', background: '#fff', boxSizing: 'border-box' }}
          />
        </div>
        <select
          value={responsable} onChange={e => setResponsable(e.target.value)}
          style={{ height: 38, padding: '0 10px', border: `2px solid ${responsable ? B : '#E5E7EB'}`, background: responsable ? BL : '#fff', fontSize: 12, fontWeight: 600, color: responsable ? '#111827' : '#6B7280', minWidth: 150, cursor: 'pointer' }}
        >
          <option value="">Todos los responsables</option>
          {responsables.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <input
          type="date" value={desde} onChange={e => setDesde(e.target.value)} max={hasta || undefined}
          style={{ height: 38, padding: '0 8px', border: `2px solid ${desde ? B : '#E5E7EB'}`, background: desde ? BL : '#fff', fontSize: 12, fontWeight: 600, color: '#111827' }}
          title="Inicio desde"
        />
        <span style={{ color: '#9CA3AF', fontSize: 12 }}>→</span>
        <input
          type="date" value={hasta} onChange={e => setHasta(e.target.value)} min={desde || undefined}
          style={{ height: 38, padding: '0 8px', border: `2px solid ${hasta ? B : '#E5E7EB'}`, background: hasta ? BL : '#fff', fontSize: 12, fontWeight: 600, color: '#111827' }}
          title="Inicio hasta"
        />
        {hayFiltros && (
          <button
            onClick={limpiar}
            style={{ height: 38, padding: '0 12px', background: '#fff', border: '2px solid #E5E7EB', color: '#6B7280', fontWeight: 600, fontSize: 12, cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}
            title="Limpiar filtros"
          >
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* stats */}
      {filtradas.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, background: BL, border: `1px solid ${B}33`, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280' }}>Inventarios cerrados</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 700, color: B }}>
              {filtradas.length}{hayFiltros && rows.length !== filtradas.length ? <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}> /{rows.length}</span> : null}
            </div>
          </div>
          <div style={{ flex: 1, background: GL, border: '1px solid #6EE7B7', padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280' }}>Promedio unidades</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 700, color: G }}>{promedio}</div>
          </div>
        </div>
      )}

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#DC2626' }}>✕ {error}</div>}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
      ) : filtradas.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 14, background: '#fff', border: '1px solid #E5E7EB' }}>
          {rows.length === 0 ? 'No hay inventarios cerrados para este depósito todavía.' : 'Sin resultados con los filtros aplicados.'}
        </div>
      ) : (
        <div className="scroll-pc" style={{ background: '#fff', border: '1px solid #E5E7EB', maxHeight: 'calc(100vh - 360px)', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#CBD5E1 #F3F4F6', scrollBehavior: 'smooth' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px 80px 100px 100px', padding: '8px 14px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0, zIndex: 2 }}>
            {['Inventario', 'Período', 'Responsable', 'Zonas', 'Productos', 'Unidades'].map((h, i) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9CA3AF', textAlign: i >= 3 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>
          {filtradas.map((r, i) => {
            const variacion = promedio ? ((r.unidades - promedio) / promedio) * 100 : 0
            return (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px 80px 100px 100px', padding: '11px 14px', borderBottom: i < filtradas.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'center', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</div>
                </div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>
                  {fmtFecha(r.fecha_inicio) || '—'}{r.fecha_limite ? ` → ${fmtFecha(r.fecha_limite)}` : ''}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.responsable || '—'}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: '#374151', textAlign: 'right' }}>{r.zonas}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: B, fontWeight: 700, textAlign: 'right' }}>{r.productos}</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: G }}>{r.unidades}</div>
                  {filtradas.length > 1 && (
                    <div style={{ fontSize: 10, color: Math.abs(variacion) < 1 ? '#9CA3AF' : variacion > 0 ? G : '#DC2626', fontFamily: "'DM Mono',monospace" }}>
                      {variacion >= 0 ? '+' : ''}{variacion.toFixed(1)}% vs promedio
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
