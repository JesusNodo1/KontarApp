import { useEffect, useMemo, useState } from 'react'
import { B, BL, G, GL } from '../../../constants/theme'
import { getReporteConteo, exportToXlsx } from '../../../services/reportService'
import Spinner from '../../../components/Spinner'

function fmtHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const normalize = s => (s || '').toString().toLowerCase().trim()

export default function ReporteConteo({ inventario }) {
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
          style={{ padding: '0 18px', height: 42, background: filtradas.length === 0 || loading ? '#E5E7EB' : G, border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: filtradas.length === 0 || loading ? 'not-allowed' : 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1={12} y1={15} x2={12} y2={3}/></svg>
          Exportar Excel
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
        <div style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 140px 110px 64px', padding: '8px 14px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
            {['Cód. Barras', 'Producto', 'Zona', 'Usuario', 'Cant.'].map((h, i) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9CA3AF', textAlign: i === 4 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>
          <div style={{ maxHeight: 'calc(100vh - 460px)', overflowY: 'auto' }}>
            {filtradas.map((c, i) => (
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
