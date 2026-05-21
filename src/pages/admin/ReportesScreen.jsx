import { useEffect, useMemo, useState } from 'react'
import { B, BL, G, GL } from '../../constants/theme'
import { getSucursales, getDepositos, getInventarios } from '../../services/adminService'
import { fmtFecha } from '../../services/conteoService'
import Spinner from '../../components/Spinner'
import ReporteConteo      from './reportes/ReporteConteo'
import ReporteDiferencias from './reportes/ReporteDiferencias'
import ReporteAuditoria   from './reportes/ReporteAuditoria'
import ReporteHistorico   from './reportes/ReporteHistorico'

const TABS = [
  { k: 'conteo',      label: 'Conteo',      needs: 'inventario' },
  { k: 'diferencias', label: 'Diferencias', needs: 'inventario' },
  { k: 'auditoria',   label: 'Auditoría',   needs: 'inventario' },
  { k: 'historico',   label: 'Histórico',   needs: 'deposito'   },
]

function Field({ label, children }) {
  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )
}

export default function ReportesScreen() {
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const [sucursales, setSucursales] = useState([])
  const [depositos,  setDepositos]  = useState([])
  const [inventarios, setInventarios] = useState([])

  const [sucId, setSucId] = useState('')
  const [depId, setDepId] = useState('')
  const [invId, setInvId] = useState('')

  const [tab, setTab] = useState('conteo')

  useEffect(() => {
    (async () => {
      setLoading(true); setError('')
      try {
        const [sucs, deps, invs] = await Promise.all([getSucursales(false), getDepositos(false), getInventarios()])
        setSucursales(sucs)
        setDepositos(deps)
        setInventarios(invs)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const depsFiltrados = useMemo(
    () => sucId ? depositos.filter(d => d.sucursal_id === Number(sucId)) : depositos,
    [depositos, sucId],
  )

  const invsFiltrados = useMemo(() => {
    let r = inventarios
    if (sucId) {
      const sucNom = sucursales.find(s => s.id === Number(sucId))?.nombre
      if (sucNom) r = r.filter(i => i.sucursal === sucNom)
    }
    if (depId) r = r.filter(i => i.deposito_id === Number(depId))
    return r
  }, [inventarios, sucursales, sucId, depId])

  // Resetear selecciones dependientes cuando cambian filtros
  useEffect(() => { setDepId(''); setInvId('') }, [sucId])
  useEffect(() => { setInvId('') }, [depId])

  const inventario = inventarios.find(i => i.id === Number(invId)) || null
  const deposito   = depositos.find(d => d.id === Number(depId))   || null

  const tabActual = TABS.find(t => t.k === tab)
  const necesita  = tabActual?.needs

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Reportes</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Filtrá por sucursal, depósito e inventario, y exportá los resultados.</div>
      </div>

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#DC2626' }}>✕ {error}</div>}

      {/* filtros */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderTop: `3px solid ${B}`, padding: '14px 16px', marginBottom: 14, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <Field label="Sucursal">
          <select
            value={sucId} onChange={e => setSucId(e.target.value)}
            style={{ width: '100%', height: 38, border: `2px solid ${sucId ? B : '#E5E7EB'}`, padding: '0 10px', fontSize: 13, fontWeight: 600, color: sucId ? '#111827' : '#9CA3AF', background: sucId ? BL : '#F9FAFB', appearance: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
          >
            <option value="">Todas las sucursales</option>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}{!s.activo ? ' (inactiva)' : ''}</option>)}
          </select>
        </Field>
        <Field label="Depósito">
          <select
            value={depId} onChange={e => setDepId(e.target.value)}
            style={{ width: '100%', height: 38, border: `2px solid ${depId ? B : '#E5E7EB'}`, padding: '0 10px', fontSize: 13, fontWeight: 600, color: depId ? '#111827' : '#9CA3AF', background: depId ? BL : '#F9FAFB', appearance: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
          >
            <option value="">{sucId ? 'Todos los depósitos de la sucursal' : 'Todos los depósitos'}</option>
            {depsFiltrados.map(d => <option key={d.id} value={d.id}>{d.nombre}{!d.activo ? ' (inactivo)' : ''}</option>)}
          </select>
        </Field>
        <Field label="Inventario">
          <select
            value={invId} onChange={e => setInvId(e.target.value)}
            disabled={necesita !== 'inventario'}
            title={necesita === 'deposito' ? 'No se usa en el reporte Histórico' : ''}
            style={{ width: '100%', height: 38, border: `2px solid ${invId ? B : '#E5E7EB'}`, padding: '0 10px', fontSize: 13, fontWeight: 600, color: invId ? '#111827' : '#9CA3AF', background: necesita !== 'inventario' ? '#F3F4F6' : invId ? BL : '#F9FAFB', appearance: 'none', cursor: necesita !== 'inventario' ? 'not-allowed' : 'pointer', boxSizing: 'border-box' }}
          >
            <option value="">Seleccioná inventario...</option>
            {invsFiltrados.map(i => (
              <option key={i.id} value={i.id}>
                {i.nombre} · {i.estado}{i.fecha_inicio ? ` · ${fmtFecha(i.fecha_inicio)}` : ''}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #E5E7EB', flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const active = tab === t.k
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              style={{
                padding: '10px 18px',
                background: active ? '#fff' : 'transparent',
                border: 'none',
                borderBottom: `3px solid ${active ? B : 'transparent'}`,
                color: active ? B : '#6B7280',
                fontWeight: active ? 700 : 600,
                fontSize: 13,
                cursor: 'pointer',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* hint si falta filtro */}
      {necesita === 'inventario' && !inventario && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#92400E' }}>
          ⚠ Seleccioná un inventario en el filtro de arriba para ver el reporte.
        </div>
      )}
      {necesita === 'deposito' && !deposito && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#92400E' }}>
          ⚠ Seleccioná un depósito en el filtro de arriba para ver el histórico.
        </div>
      )}

      {/* contenido del tab */}
      {tab === 'conteo'      && <ReporteConteo      inventario={inventario} />}
      {tab === 'diferencias' && <ReporteDiferencias inventario={inventario} />}
      {tab === 'auditoria'   && <ReporteAuditoria   inventario={inventario} />}
      {tab === 'historico'   && <ReporteHistorico   deposito={deposito} />}
    </div>
  )
}
