import { useCallback, useState } from 'react'
import { G } from '../../../constants/theme'
import DiferenciasPanel from '../DiferenciasPanel'
import { exportToXlsx } from '../../../services/reportService'

const ESTADO_LABEL = {
  'ok':           'OK',
  'pendiente':    'Pendiente',
  'faltante':     'Faltante',
  'sobrante':     'Sobrante',
  'no-esperado':  'No esperado',
}

const FILTRO_SLUG = {
  todos:         'todos',
  diferencias:   'diferencias',
  pendiente:     'pendientes',
  faltante:      'faltantes',
  sobrante:      'sobrantes',
  'no-esperado': 'no_esperados',
  ok:            'ok',
}

export default function ReporteDiferencias({ inventario }) {
  // vista actual del panel: filas visibles + filtro/pestaña activa
  const [view, setView] = useState({ filas: [], filtro: 'todos' })
  const onView = useCallback(v => setView(v), [])

  if (!inventario) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 14, background: '#fff', border: '1px solid #E5E7EB' }}>
        Seleccioná un inventario para ver el reporte.
      </div>
    )
  }

  const handleExport = () => {
    if (!view.filas.length) return
    const rowsX = view.filas.map(f => ({
      codigo_barras: f.codigo_barras || '',
      sku:           f.sku || '',
      producto:      f.nombre || '',
      variante:      f.variante || '',
      teorico:       f.teorico,
      contado:       f.contado,
      diferencia:    f.diferencia,
      estado:        ESTADO_LABEL[f.estado] || f.estado,
      pct:           f.pct != null ? Number(f.pct.toFixed(2)) : '',
      valor:         f.valor != null ? Number(f.valor.toFixed(2)) : '',
    }))
    const slug = FILTRO_SLUG[view.filtro] || 'resultados'
    exportToXlsx(
      rowsX,
      [
        { key: 'codigo_barras', label: 'Cód. Barras' },
        { key: 'sku',           label: 'SKU' },
        { key: 'producto',      label: 'Producto' },
        { key: 'variante',      label: 'Variante' },
        { key: 'teorico',       label: 'Teórico' },
        { key: 'contado',       label: 'Contado' },
        { key: 'diferencia',    label: 'Diferencia' },
        { key: 'pct',           label: '% Variación' },
        { key: 'valor',         label: 'Valor diferencia' },
        { key: 'estado',        label: 'Estado' },
      ],
      `diferencias_${slug}_${inventario.nombre || 'inventario'}`.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase(),
      slug.slice(0, 31),
    )
  }

  const exportBtn = (
    <button
      onClick={handleExport}
      disabled={!view.filas.length}
      title={`Exportar ${view.filas.length} fila(s) visibles (filtro: ${view.filtro})`}
      style={{ height: 38, padding: '0 14px', background: !view.filas.length ? '#E5E7EB' : G, border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: !view.filas.length ? 'not-allowed' : 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}
    >
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1={12} y1={15} x2={12} y2={3}/></svg>
      Excel
    </button>
  )

  return (
    <DiferenciasPanel inventario={inventario} onView={onView} extraToolbar={exportBtn} />
  )
}
