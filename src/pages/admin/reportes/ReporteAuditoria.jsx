import { useEffect, useMemo, useState } from 'react'
import { B, BL, G, GL } from '../../../constants/theme'
import { getReporteAuditoria, exportToXlsx } from '../../../services/reportService'
import Spinner from '../../../components/Spinner'

function fmtHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const normalize = s => (s || '').toString().toLowerCase().trim()

export default function ReporteAuditoria({ inventario }) {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [q,       setQ]       = useState('')
  const [tipoDelta, setTipoDelta] = useState('todos') // todos | suma | resta

  useEffect(() => {
    if (!inventario) { setRows([]); return }
    setLoading(true); setError(''); setRows([])
    getReporteAuditoria(inventario.id)
      .then(setRows)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [inventario?.id])

  const filtradas = useMemo(() => {
    let r = rows
    if (tipoDelta === 'suma')  r = r.filter(x => (x.delta ?? (x.next - x.prev)) > 0)
    if (tipoDelta === 'resta') r = r.filter(x => (x.delta ?? (x.next - x.prev)) < 0)
    if (!q.trim()) return r
    const n = normalize(q)
    return r.filter(s =>
      normalize(s.producto?.nombre).includes(n)        ||
      normalize(s.producto?.variante).includes(n)      ||
      normalize(s.producto?.codigo_barras).includes(n) ||
      normalize(s.producto?.sku).includes(n)           ||
      normalize(s.zona?.nombre).includes(n)            ||
      normalize(s.usuario?.nombre).includes(n)
    )
  }, [rows, q, tipoDelta])

  const sumas = filtradas.filter(x => (x.delta ?? (x.next - x.prev)) > 0).length
  const restas = filtradas.filter(x => (x.delta ?? (x.next - x.prev)) < 0).length

  const handleExport = () => {
    if (filtradas.length === 0) return
    const rowsX = filtradas.map(s => ({
      fecha:          fmtHora(s.created_at),
      usuario:        s.usuario?.nombre || '',
      zona:           s.zona?.nombre || '',
      codigo_barras:  s.producto?.codigo_barras || '',
      sku:            s.producto?.sku || '',
      producto:       s.producto?.nombre || '',
      variante:       s.producto?.variante || '',
      prev:           s.prev,
      next:           s.next,
      delta:          s.delta ?? (s.next - s.prev),
    }))
    exportToXlsx(
      rowsX,
      [
        { key: 'fecha',         label: 'Fecha' },
        { key: 'usuario',       label: 'Usuario' },
        { key: 'zona',          label: 'Zona' },
        { key: 'codigo_barras', label: 'Cód. Barras' },
        { key: 'sku',           label: 'SKU' },
        { key: 'producto',      label: 'Producto' },
        { key: 'variante',      label: 'Variante' },
        { key: 'prev',          label: 'Antes' },
        { key: 'next',          label: 'Después' },
        { key: 'delta',         label: 'Delta' },
      ],
      `auditoria_${inventario.nombre || 'inventario'}`.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase(),
      'Auditoría',
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
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
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

      {/* filtros tipo */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { k: 'todos', l: `Todos (${rows.length})` },
          { k: 'suma',  l: `Sumas (${rows.filter(x => (x.delta ?? (x.next - x.prev)) > 0).length})` },
          { k: 'resta', l: `Restas / deshacer (${rows.filter(x => (x.delta ?? (x.next - x.prev)) < 0).length})` },
        ].map(f => {
          const a = tipoDelta === f.k
          return (
            <button key={f.k} onClick={() => setTipoDelta(f.k)} style={{ padding: '6px 12px', background: a ? B : '#fff', border: `1px solid ${a ? B : '#E5E7EB'}`, color: a ? '#fff' : '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>{f.l}</button>
          )
        })}
      </div>

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#DC2626' }}>✕ {error}</div>}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
      ) : filtradas.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 14, background: '#fff', border: '1px solid #E5E7EB' }}>
          {rows.length === 0 ? 'No hay scans registrados en este inventario.' : 'Sin resultados.'}
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '130px 110px 1fr 130px 100px 56px 56px 64px', padding: '8px 14px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
            {['Fecha', 'Cód.', 'Producto', 'Zona', 'Usuario', 'Antes', 'Desp.', 'Delta'].map((h, i) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9CA3AF', textAlign: i >= 5 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>
          <div style={{ maxHeight: 'calc(100vh - 460px)', overflowY: 'auto' }}>
            {filtradas.map((s, i) => {
              const delta = s.delta ?? (s.next - s.prev)
              return (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '130px 110px 1fr 130px 100px 56px 56px 64px', padding: '10px 14px', borderBottom: i < filtradas.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'center', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#6B7280' }}>{fmtHora(s.created_at)}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: B, fontWeight: 600, background: BL, border: '1px solid #BFDBFE', padding: '2px 6px', display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.producto?.codigo_barras || s.producto?.sku || '—'}
                  </div>
                  <div style={{ paddingLeft: 8, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.producto?.nombre || '—'}
                      {s.producto?.variante && <span style={{ color: '#6B7280', fontWeight: 400 }}> · {s.producto.variante}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.zona?.nombre || '—'}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.usuario?.nombre || '—'}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: '#9CA3AF', textAlign: 'right' }}>{s.prev}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: '#111827', textAlign: 'right' }}>{s.next}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: delta >= 0 ? G : '#DC2626', textAlign: 'right' }}>
                    {delta >= 0 ? '+' : ''}{delta}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
