import { useEffect, useMemo, useState } from 'react'
import { B, BL, G, GL } from '../../../constants/theme'
import { getReporteConteo, exportToXlsx } from '../../../services/reportService'
import Spinner from '../../../components/Spinner'
import { useIsNarrow } from '../../../hooks/useIsNarrow'

function fmtHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const normalize = s => (s || '').toString().toLowerCase().trim()

export default function ReporteConteo({ inventario }) {
  const isNarrow = useIsNarrow()
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [q,       setQ]       = useState('')
  const [zonaId,  setZonaId]  = useState('')
  const [userNom, setUserNom] = useState('')
  const [variante, setVariante] = useState('')
  const [desde,   setDesde]   = useState('')
  const [hasta,   setHasta]   = useState('')

  useEffect(() => {
    if (!inventario) { setRows([]); return }
    setLoading(true); setError(''); setRows([])
    getReporteConteo(inventario.id)
      .then(setRows)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [inventario?.id])

  const zonas = useMemo(() => {
    const map = new Map()
    for (const r of rows) {
      const z = r.zona
      if (z?.id != null && !map.has(z.id)) map.set(z.id, z.nombre || `Zona ${z.id}`)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows])

  const usuarios = useMemo(() => {
    const set = new Set()
    for (const r of rows) {
      const n = r.usuario?.nombre
      if (n) set.add(n)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [rows])

  const variantes = useMemo(() => {
    const set = new Set()
    for (const r of rows) {
      const v = r.producto?.variante
      if (v) set.add(v)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [rows])

  const filtradas = useMemo(() => {
    const n = normalize(q)
    const desdeMs = desde ? new Date(desde + 'T00:00:00').getTime() : null
    const hastaMs = hasta ? new Date(hasta + 'T23:59:59').getTime() : null
    return rows.filter(c => {
      if (zonaId && Number(c.zona?.id) !== Number(zonaId)) return false
      if (userNom && c.usuario?.nombre !== userNom) return false
      if (variante && (c.producto?.variante || '') !== variante) return false
      if (desdeMs || hastaMs) {
        const t = c.updated_at ? new Date(c.updated_at).getTime() : NaN
        if (Number.isNaN(t)) return false
        if (desdeMs && t < desdeMs) return false
        if (hastaMs && t > hastaMs) return false
      }
      if (!n) return true
      return (
        normalize(c.producto?.nombre).includes(n)        ||
        normalize(c.producto?.variante).includes(n)      ||
        normalize(c.producto?.codigo_barras).includes(n) ||
        normalize(c.producto?.sku).includes(n)           ||
        normalize(c.zona?.nombre).includes(n)            ||
        normalize(c.usuario?.nombre).includes(n)
      )
    })
  }, [rows, q, zonaId, userNom, variante, desde, hasta])

  const hayFiltros = q || zonaId || userNom || variante || desde || hasta
  const limpiar = () => { setQ(''); setZonaId(''); setUserNom(''); setVariante(''); setDesde(''); setHasta('') }

  const totalUnidades  = filtradas.reduce((s, r) => s + (Number(r.cantidad) || 0), 0)
  const totalProductos = new Set(filtradas.map(r => r.producto?.id).filter(Boolean)).size

  const handleExport = () => {
    if (filtradas.length === 0) return
    const rowsX = filtradas.map(r => ({
      codigo_barras: r.producto?.codigo_barras || '',
      sku:           r.producto?.sku || '',
      producto:      r.producto?.nombre || '',
      variante:      r.producto?.variante || '',
      zona:          r.zona?.nombre || '',
      cantidad:      r.cantidad,
      usuario:       r.usuario?.nombre || '',
      fecha:         fmtHora(r.updated_at),
    }))
    exportToXlsx(
      rowsX,
      [
        { key: 'codigo_barras', label: 'Cód. Barras' },
        { key: 'sku',           label: 'SKU' },
        { key: 'producto',      label: 'Producto' },
        { key: 'variante',      label: 'Variante' },
        { key: 'zona',          label: 'Zona' },
        { key: 'cantidad',      label: 'Cantidad' },
        { key: 'usuario',       label: 'Usuario' },
        { key: 'fecha',         label: 'Fecha' },
      ],
      `conteo_${inventario.nombre || 'inventario'}`.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase(),
      'Conteo',
    )
  }

  // Export totalizado: 1 fila por producto, sumando todas las zonas.
  const handleExportTotal = () => {
    if (filtradas.length === 0) return
    const map = new Map() // producto_id → { producto, total, zonas:Set }
    for (const r of filtradas) {
      const pid = r.producto?.id
      if (pid == null) continue
      let entry = map.get(pid)
      if (!entry) {
        entry = { producto: r.producto, total: 0, zonas: new Set() }
        map.set(pid, entry)
      }
      entry.total += Number(r.cantidad) || 0
      if (r.zona?.nombre) entry.zonas.add(r.zona.nombre)
    }
    const rowsX = [...map.values()]
      .sort((a, b) => (a.producto?.nombre || '').localeCompare(b.producto?.nombre || ''))
      .map(e => ({
        codigo_barras: e.producto?.codigo_barras || '',
        sku:           e.producto?.sku || '',
        producto:      e.producto?.nombre || '',
        variante:      e.producto?.variante || '',
        total:         e.total,
        num_zonas:     e.zonas.size,
        zonas:         [...e.zonas].sort().join(', '),
      }))
    exportToXlsx(
      rowsX,
      [
        { key: 'codigo_barras', label: 'Cód. Barras' },
        { key: 'sku',           label: 'SKU' },
        { key: 'producto',      label: 'Producto' },
        { key: 'variante',      label: 'Variante' },
        { key: 'total',         label: 'Total' },
        { key: 'num_zonas',     label: 'N° zonas' },
        { key: 'zonas',         label: 'Zonas' },
      ],
      `conteo_total_${inventario.nombre || 'inventario'}`.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase(),
      'Total por producto',
    )
  }

  if (!inventario) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 14, background: '#fff', border: '1px solid #E5E7EB' }}>
        Seleccioná un inventario para ver el reporte.
      </div>
    )
  }

  return (
    <div>
      {/* toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><circle cx={11} cy={11} r={7}/><path d="M21 21l-4.35-4.35"/></svg>
          </span>
          <input
            value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar producto, código, zona, usuario..." autoComplete="off"
            style={{ width: '100%', height: 42, border: '2px solid #E5E7EB', paddingLeft: 38, paddingRight: 14, fontSize: 14, color: '#111827', background: '#fff', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = B}
            onBlur={e => e.target.style.borderColor = '#E5E7EB'}
          />
        </div>
        <button
          onClick={handleExport}
          disabled={loading || filtradas.length === 0}
          title="Detalle: 1 fila por zona/usuario"
          style={{ padding: '0 14px', height: 42, background: filtradas.length === 0 || loading ? '#E5E7EB' : G, border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: filtradas.length === 0 || loading ? 'not-allowed' : 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1={12} y1={15} x2={12} y2={3}/></svg>
          Excel · Detalle
        </button>
        <button
          onClick={handleExportTotal}
          disabled={loading || filtradas.length === 0}
          title="Totalizado: 1 fila por producto, sumando todas las zonas"
          style={{ padding: '0 14px', height: 42, background: filtradas.length === 0 || loading ? '#E5E7EB' : '#fff', border: `2px solid ${filtradas.length === 0 || loading ? '#E5E7EB' : G}`, color: filtradas.length === 0 || loading ? '#9CA3AF' : G, fontWeight: 700, fontSize: 12, cursor: filtradas.length === 0 || loading ? 'not-allowed' : 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><path d="M3 3h18v18H3z M3 9h18 M9 21V9"/></svg>
          Excel · Totalizado
        </button>
      </div>

      {/* filtros: zona / usuario / fechas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={zonaId} onChange={e => setZonaId(e.target.value)}
          style={{ height: 38, padding: '0 10px', border: `2px solid ${zonaId ? B : '#E5E7EB'}`, background: zonaId ? BL : '#fff', fontSize: 12, fontWeight: 600, color: zonaId ? '#111827' : '#6B7280', minWidth: 150, cursor: 'pointer' }}
        >
          <option value="">Todas las zonas</option>
          {zonas.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
        </select>
        <select
          value={userNom} onChange={e => setUserNom(e.target.value)}
          style={{ height: 38, padding: '0 10px', border: `2px solid ${userNom ? B : '#E5E7EB'}`, background: userNom ? BL : '#fff', fontSize: 12, fontWeight: 600, color: userNom ? '#111827' : '#6B7280', minWidth: 150, cursor: 'pointer' }}
        >
          <option value="">Todos los usuarios</option>
          {usuarios.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select
          value={variante} onChange={e => setVariante(e.target.value)}
          style={{ height: 38, padding: '0 10px', border: `2px solid ${variante ? B : '#E5E7EB'}`, background: variante ? BL : '#fff', fontSize: 12, fontWeight: 600, color: variante ? '#111827' : '#6B7280', minWidth: 150, cursor: 'pointer' }}
          title="Filtrar por variante (tipo de producto)"
        >
          <option value="">Todas las variantes</option>
          {variantes.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <input
          type="date" value={desde} onChange={e => setDesde(e.target.value)} max={hasta || undefined}
          style={{ height: 38, padding: '0 8px', border: `2px solid ${desde ? B : '#E5E7EB'}`, background: desde ? BL : '#fff', fontSize: 12, fontWeight: 600, color: '#111827' }}
          title="Desde"
        />
        <span style={{ color: '#9CA3AF', fontSize: 12 }}>→</span>
        <input
          type="date" value={hasta} onChange={e => setHasta(e.target.value)} min={desde || undefined}
          style={{ height: 38, padding: '0 8px', border: `2px solid ${hasta ? B : '#E5E7EB'}`, background: hasta ? BL : '#fff', fontSize: 12, fontWeight: 600, color: '#111827' }}
          title="Hasta"
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
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120, background: BL, border: `1px solid ${B}33`, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280' }}>Productos</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 700, color: B }}>{totalProductos}</div>
        </div>
        <div style={{ flex: 1, minWidth: 120, background: GL, border: '1px solid #6EE7B7', padding: '10px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280' }}>Unidades</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 700, color: G }}>{totalUnidades}</div>
        </div>
      </div>

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#DC2626' }}>✕ {error}</div>}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
      ) : filtradas.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 14, background: '#fff', border: '1px solid #E5E7EB' }}>
          {rows.length === 0 ? 'No hay conteos para este inventario.' : 'Sin resultados.'}
        </div>
      ) : (
        <div className="scroll-pc" style={{ background: '#fff', border: '1px solid #E5E7EB', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#CBD5E1 #F3F4F6', scrollBehavior: 'smooth' }}>
          {!isNarrow && (
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 140px 110px 64px', padding: '8px 14px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0, zIndex: 2 }}>
              {['Cód. Barras', 'Producto', 'Zona', 'Usuario', 'Cant.'].map((h, i) => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9CA3AF', textAlign: i === 4 ? 'right' : 'left' }}>{h}</div>
              ))}
            </div>
          )}
          <div>
            {filtradas.map((c, i) => isNarrow ? (
              // ── Card mobile ──
              <div key={i} style={{ padding: '12px 14px', borderBottom: i < filtradas.length - 1 ? '1px solid #F3F4F6' : 'none', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: B, fontWeight: 600, background: BL, border: '1px solid #BFDBFE', padding: '2px 6px', display: 'inline-block', marginBottom: 4 }}>
                      {c.producto?.codigo_barras || c.producto?.sku || '—'}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', lineHeight: 1.3 }}>
                      {c.producto?.nombre || '—'}
                      {c.producto?.variante && <span style={{ color: '#6B7280', fontWeight: 400 }}> · {c.producto.variante}</span>}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 700, color: G, lineHeight: 1 }}>{c.cantidad}</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 11, color: '#6B7280' }}>
                  <span><b style={{ color: '#374151', fontWeight: 600 }}>Zona:</b> {c.zona?.nombre || '—'}</span>
                  <span><b style={{ color: '#374151', fontWeight: 600 }}>Usuario:</b> {c.usuario?.nombre || '—'}</span>
                  <span style={{ color: '#9CA3AF' }}>{fmtHora(c.updated_at)}</span>
                </div>
              </div>
            ) : (
              // ── Tabla desktop ──
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 140px 110px 64px', padding: '10px 14px', borderBottom: i < filtradas.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'center', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: B, fontWeight: 600, background: BL, border: '1px solid #BFDBFE', padding: '2px 6px', display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.producto?.codigo_barras || c.producto?.sku || '—'}
                </div>
                <div style={{ paddingLeft: 8, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.producto?.nombre || '—'}
                    {c.producto?.variante && <span style={{ color: '#6B7280', fontWeight: 400 }}> · {c.producto.variante}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{fmtHora(c.updated_at)}</div>
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.zona?.nombre || '—'}</div>
                <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.usuario?.nombre || '—'}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700, color: G, textAlign: 'right' }}>{c.cantidad}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
