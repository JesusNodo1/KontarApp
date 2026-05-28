import { useEffect, useMemo, useState } from 'react'
import { B, BL, G, GL } from '../../../constants/theme'
import { getReporteDispersion, exportToXlsx } from '../../../services/reportService'
import Spinner from '../../../components/Spinner'
import { useIsNarrow } from '../../../hooks/useIsNarrow'

const normalize = s => (s || '').toString().toLowerCase().trim()

export default function ReporteDispersion({ inventario }) {
  const isNarrow = useIsNarrow()
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [q,       setQ]       = useState('')
  const [minZonas, setMinZonas] = useState('')
  const [variante, setVariante] = useState('')
  const [expandido, setExpandido] = useState(() => new Set())

  useEffect(() => {
    if (!inventario) { setRows([]); return }
    setLoading(true); setError(''); setRows([]); setExpandido(new Set())
    getReporteDispersion(inventario.id)
      .then(setRows)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [inventario?.id])

  const variantes = useMemo(() => {
    const set = new Set()
    for (const r of rows) { const v = r.producto?.variante; if (v) set.add(v) }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [rows])

  const filtradas = useMemo(() => {
    const n = normalize(q)
    const mz = minZonas === '' ? null : Math.max(1, Number(minZonas) || 1)
    let r = rows
    if (mz != null) r = r.filter(x => x.numZonas >= mz)
    if (variante) r = r.filter(x => (x.producto?.variante || '') === variante)
    if (n) {
      r = r.filter(x =>
        normalize(x.producto?.nombre).includes(n)        ||
        normalize(x.producto?.variante).includes(n)      ||
        normalize(x.producto?.codigo_barras).includes(n) ||
        normalize(x.producto?.sku).includes(n)
      )
    }
    return [...r].sort((a, b) => b.numZonas - a.numZonas || b.total - a.total)
  }, [rows, q, minZonas, variante])

  const hayFiltros = q || minZonas || variante
  const limpiar = () => { setQ(''); setMinZonas(''); setVariante('') }

  // Stats: cuántos productos están en 1 sola zona vs en 2+
  const totalProductos = rows.length
  const dispersos = rows.filter(r => r.numZonas > 1).length
  const maxZonas = rows.reduce((m, r) => Math.max(m, r.numZonas), 0)

  const toggleExpand = (pid) => {
    setExpandido(prev => {
      const s = new Set(prev)
      if (s.has(pid)) s.delete(pid); else s.add(pid)
      return s
    })
  }

  const handleExport = () => {
    if (filtradas.length === 0) return
    // Una fila por (producto, zona) con cantidad y % del total del producto
    const rowsX = []
    for (const p of filtradas) {
      for (const z of p.zonas) {
        rowsX.push({
          codigo_barras: p.producto?.codigo_barras || '',
          sku:           p.producto?.sku || '',
          producto:      p.producto?.nombre || '',
          variante:      p.producto?.variante || '',
          zona:          z.zona?.nombre || '—',
          cantidad:      z.cantidad,
          pct_producto:  p.total > 0 ? Number(((z.cantidad / p.total) * 100).toFixed(2)) : 0,
          total_producto: p.total,
          num_zonas:     p.numZonas,
        })
      }
    }
    exportToXlsx(
      rowsX,
      [
        { key: 'codigo_barras',   label: 'Cód. Barras' },
        { key: 'sku',             label: 'SKU' },
        { key: 'producto',        label: 'Producto' },
        { key: 'variante',        label: 'Variante' },
        { key: 'zona',            label: 'Zona' },
        { key: 'cantidad',        label: 'Cantidad' },
        { key: 'pct_producto',    label: '% del producto' },
        { key: 'total_producto',  label: 'Total producto' },
        { key: 'num_zonas',       label: 'N° zonas' },
      ],
      `dispersion_${inventario.nombre || 'inventario'}`.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase(),
      'Dispersión',
    )
  }

  if (!inventario) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 14, background: '#fff', border: '1px solid #E5E7EB' }}>
        Seleccioná un inventario para ver la dispersión por zona.
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
            value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar producto, código, SKU..." autoComplete="off"
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

      {/* filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6B7280', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Mín. zonas
          <input
            type="number" min="1" inputMode="numeric"
            placeholder="≥ 1"
            value={minZonas} onChange={e => setMinZonas(e.target.value)}
            style={{ width: 90, height: 38, border: `2px solid ${minZonas ? B : '#E5E7EB'}`, background: minZonas ? BL : '#fff', padding: '0 10px', fontSize: 13, fontFamily: "'DM Mono',monospace", color: '#111827' }}
            title="Mostrar sólo productos que aparecen en al menos N zonas"
          />
        </label>
        {[2, 3, 5].map(n => (
          <button
            key={n}
            onClick={() => setMinZonas(String(n))}
            style={{ height: 38, padding: '0 12px', background: String(minZonas) === String(n) ? B : '#fff', border: `1px solid ${String(minZonas) === String(n) ? B : '#E5E7EB'}`, color: String(minZonas) === String(n) ? '#fff' : '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
          >
            {n}+ zonas
          </button>
        ))}
        <select
          value={variante} onChange={e => setVariante(e.target.value)}
          style={{ height: 38, padding: '0 10px', border: `2px solid ${variante ? B : '#E5E7EB'}`, background: variante ? BL : '#fff', fontSize: 12, fontWeight: 600, color: variante ? '#111827' : '#6B7280', minWidth: 150, cursor: 'pointer' }}
          title="Filtrar por variante (tipo de producto)"
        >
          <option value="">Todas las variantes</option>
          {variantes.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        {hayFiltros && (
          <button
            onClick={limpiar}
            style={{ height: 38, padding: '0 12px', background: '#fff', border: '2px solid #E5E7EB', color: '#6B7280', fontWeight: 600, fontSize: 12, cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}
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
        <div style={{ flex: 1, minWidth: 120, background: '#FFFBEB', border: '1px solid #FDE68A', padding: '10px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280' }}>En 2+ zonas</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 700, color: '#92400E' }}>{dispersos}</div>
        </div>
        <div style={{ flex: 1, minWidth: 120, background: GL, border: '1px solid #6EE7B7', padding: '10px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280' }}>Máx. dispersión</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 700, color: G }}>{maxZonas}</div>
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
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 70px 80px 1fr 28px', padding: '8px 14px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0, zIndex: 2 }}>
              {['Código', 'Producto', 'N° Zonas', 'Total', 'Zona principal', ''].map((h, i) => (
                <div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9CA3AF', textAlign: i === 2 || i === 3 ? 'right' : 'left' }}>{h}</div>
              ))}
            </div>
          )}
          <div>
            {filtradas.map((p, i) => {
              const pid = p.producto?.id ?? i
              const abierto = expandido.has(pid)
              const concentracionColor = p.concentracion >= 90 ? G : p.concentracion >= 60 ? '#92400E' : '#DC2626'
              return (
                <div key={pid} style={{ borderBottom: i < filtradas.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  {isNarrow ? (
                    // ── Card mobile ──
                    <div
                      onClick={() => toggleExpand(pid)}
                      style={{ padding: '12px 14px', background: abierto ? BL : (i % 2 === 0 ? '#fff' : '#FAFAFA'), cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: B, fontWeight: 600, background: '#fff', border: '1px solid #BFDBFE', padding: '2px 6px', display: 'inline-block', marginBottom: 4 }}>
                            {p.producto?.codigo_barras || p.producto?.sku || '—'}
                          </div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', lineHeight: 1.3 }}>
                            {p.producto?.nombre || '—'}
                            {p.producto?.variante && <span style={{ color: '#6B7280', fontWeight: 400 }}> · {p.producto.variante}</span>}
                          </div>
                        </div>
                        <div style={{ color: '#9CA3AF', fontSize: 16, fontWeight: 700, transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: 11 }}>
                        <div style={{ background: '#fff', padding: '6px 8px', textAlign: 'center', border: '1px solid #F3F4F6' }}>
                          <div style={{ color: '#9CA3AF', fontWeight: 700, fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Zonas</div>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: p.numZonas > 1 ? '#92400E' : '#374151', fontSize: 16 }}>{p.numZonas}</div>
                        </div>
                        <div style={{ background: '#fff', padding: '6px 8px', textAlign: 'center', border: '1px solid #F3F4F6' }}>
                          <div style={{ color: '#9CA3AF', fontWeight: 700, fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Total</div>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: G, fontSize: 16 }}>{p.total}</div>
                        </div>
                        <div style={{ background: '#fff', padding: '6px 8px', textAlign: 'center', border: '1px solid #F3F4F6' }}>
                          <div style={{ color: '#9CA3AF', fontWeight: 700, fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Concentr.</div>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: concentracionColor, fontSize: 16 }}>{p.concentracion.toFixed(0)}%</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 11, color: '#6B7280' }}>
                        <b style={{ color: '#374151', fontWeight: 600 }}>Zona principal:</b> {p.zonaPrincipal}
                      </div>
                    </div>
                  ) : (
                    // ── Tabla desktop ──
                    <div
                      onClick={() => toggleExpand(pid)}
                      style={{ display: 'grid', gridTemplateColumns: '110px 1fr 70px 80px 1fr 28px', padding: '10px 14px', alignItems: 'center', background: abierto ? BL : (i % 2 === 0 ? '#fff' : '#FAFAFA'), cursor: 'pointer' }}
                    >
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: B, fontWeight: 600, background: '#fff', border: '1px solid #BFDBFE', padding: '2px 6px', display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.producto?.codigo_barras || p.producto?.sku || '—'}
                      </div>
                      <div style={{ paddingLeft: 8, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.producto?.nombre || '—'}
                          {p.producto?.variante && <span style={{ color: '#6B7280', fontWeight: 400 }}> · {p.producto.variante}</span>}
                        </div>
                      </div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700, color: p.numZonas > 1 ? '#92400E' : '#374151', textAlign: 'right' }}>{p.numZonas}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: G, textAlign: 'right' }}>{p.total}</div>
                      <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 8 }}>
                        <span style={{ color: '#111827', fontWeight: 600 }}>{p.zonaPrincipal}</span>
                        {p.numZonas > 1 && (
                          <span style={{ color: concentracionColor, fontFamily: "'DM Mono',monospace", marginLeft: 6 }}>
                            {p.concentracion.toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12, transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</div>
                    </div>
                  )}
                  {abierto && (
                    <div style={{ background: '#F9FAFB', padding: isNarrow ? '8px 14px 12px 14px' : '8px 14px 12px 122px', borderTop: '1px solid #E5E7EB' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 6 }}>
                        Desglose por zona
                      </div>
                      {p.zonas.map((z, j) => {
                        const pct = p.total > 0 ? (z.cantidad / p.total) * 100 : 0
                        return (
                          <div key={j} style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr 50px 44px' : '1fr 70px 50px 120px', alignItems: 'center', padding: '4px 0', fontSize: 12, gap: 6 }}>
                            <div style={{ color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.zona?.nombre || '—'}</div>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: '#111827', textAlign: 'right' }}>{z.cantidad}</div>
                            <div style={{ fontFamily: "'DM Mono',monospace", color: '#6B7280', textAlign: 'right' }}>{pct.toFixed(0)}%</div>
                            {!isNarrow && (
                              <div style={{ marginLeft: 10, height: 6, background: '#E5E7EB', position: 'relative' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: j === 0 ? G : B }} />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
