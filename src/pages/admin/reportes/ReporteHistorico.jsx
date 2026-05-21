import { useEffect, useState } from 'react'
import { B, BL, G, GL } from '../../../constants/theme'
import { getReporteHistorico, exportToXlsx } from '../../../services/reportService'
import { fmtFecha } from '../../../services/conteoService'
import Spinner from '../../../components/Spinner'

export default function ReporteHistorico({ deposito }) {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (!deposito) { setRows([]); return }
    setLoading(true); setError(''); setRows([])
    getReporteHistorico(deposito.id)
      .then(setRows)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [deposito?.id])

  const handleExport = () => {
    if (rows.length === 0) return
    const rowsX = rows.map(r => ({
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

  // Promedio de unidades para detectar variaciones
  const promedio = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.unidades, 0) / rows.length) : 0

  return (
    <div>
      {/* toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, fontSize: 13, color: '#6B7280' }}>
          Inventarios cerrados de <strong style={{ color: '#111827' }}>{deposito.nombre}</strong>
        </div>
        <button
          onClick={handleExport}
          disabled={loading || rows.length === 0}
          style={{ padding: '0 18px', height: 42, background: rows.length === 0 || loading ? '#E5E7EB' : G, border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: rows.length === 0 || loading ? 'not-allowed' : 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1={12} y1={15} x2={12} y2={3}/></svg>
          Exportar Excel
        </button>
      </div>

      {/* stats */}
      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, background: BL, border: `1px solid ${B}33`, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280' }}>Inventarios cerrados</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 700, color: B }}>{rows.length}</div>
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
      ) : rows.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 14, background: '#fff', border: '1px solid #E5E7EB' }}>
          No hay inventarios cerrados para este depósito todavía.
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px 80px 100px 100px', padding: '8px 14px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
            {['Inventario', 'Período', 'Responsable', 'Zonas', 'Productos', 'Unidades'].map((h, i) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9CA3AF', textAlign: i >= 3 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>
          {rows.map((r, i) => {
            const variacion = promedio ? ((r.unidades - promedio) / promedio) * 100 : 0
            return (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px 80px 100px 100px', padding: '11px 14px', borderBottom: i < rows.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'center', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
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
                  {rows.length > 1 && (
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
