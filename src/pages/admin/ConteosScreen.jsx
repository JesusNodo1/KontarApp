import { useState, useEffect, useCallback, useMemo } from 'react'
import { B, BL, G, GL } from '../../constants/theme'
import {
  getInventarios, getInventarioDetalle, getZonaDetalle, getConteosInventario,
} from '../../services/adminService'
import { fmtFecha } from '../../services/conteoService'
import Spinner from '../../components/Spinner'

function fmtHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const normalize = s => (s || '').toString().toLowerCase().trim()

function matchConteo(c, q) {
  if (!q) return true
  const n = normalize(q)
  return (
    normalize(c.producto?.nombre).includes(n)    ||
    normalize(c.producto?.variante).includes(n)  ||
    normalize(c.producto?.codigo_barras).includes(n) ||
    normalize(c.producto?.sku).includes(n)       ||
    normalize(c.zona?.nombre).includes(n)        ||
    normalize(c.usuario?.nombre).includes(n)
  )
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div style={{ position: 'relative', marginBottom: 14 }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><circle cx={11} cy={11} r={7}/><path d="M21 21l-4.35-4.35"/></svg>
      </span>
      <input
        type="text" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} autoComplete="off"
        style={{ width: '100%', height: 42, border: '2px solid #E5E7EB', paddingLeft: 38, paddingRight: 14, fontSize: 14, color: '#111827', background: '#fff', boxSizing: 'border-box' }}
        onFocus={e => e.target.style.borderColor = B}
        onBlur={e => e.target.style.borderColor = '#E5E7EB'}
      />
    </div>
  )
}

function ConteosTable({ rows, showZona }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF', fontSize: 13, background: '#fff', border: '1px solid #E5E7EB' }}>
        Sin resultados.
      </div>
    )
  }
  const cols = showZona ? '110px 1fr 130px 110px 64px' : '110px 1fr 110px 64px'
  const headers = showZona
    ? ['Cód. Barras', 'Producto', 'Zona', 'Usuario', 'Cant.']
    : ['Cód. Barras', 'Producto', 'Usuario', 'Cant.']
  const total = rows.reduce((s, c) => s + (c.cantidad || 0), 0)
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '8px 14px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
        {headers.map((h, i) => (
          <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9CA3AF', textAlign: i === headers.length - 1 ? 'right' : 'left' }}>{h}</div>
        ))}
      </div>
      {rows.map((c, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, padding: '10px 14px', borderBottom: i < rows.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'center', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
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
          {showZona && (
            <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.zona?.nombre || '—'}</div>
          )}
          <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.usuario?.nombre || '—'}</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700, color: G, textAlign: 'right' }}>{c.cantidad}</div>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid #E5E7EB', background: GL }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#065F46' }}>Total unidades</span>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: G }}>{total}</span>
      </div>
    </div>
  )
}

export default function ConteosScreen() {
  // ── niveles ──
  // view: 'inv' (lista inventarios) | 'zonas' (zonas del inventario) | 'zona' (conteos de zona) | 'todo' (todos los conteos del inv)
  const [view, setView] = useState('inv')

  const [loading, setLoading] = useState(true)
  const [invs, setInvs]       = useState([])
  const [qInv, setQInv]       = useState('')

  // inventario seleccionado
  const [selInv,   setSelInv]   = useState(null)
  const [detalle,  setDetalle]  = useState(null)   // { zonas, actividad, totalConteos }
  const [loadingD, setLoadingD] = useState(false)
  const [qZona,    setQZona]    = useState('')

  // zona seleccionada
  const [selZona, setSelZona] = useState(null)
  const [zonaRows, setZonaRows] = useState([])
  const [loadingZ, setLoadingZ] = useState(false)
  const [qZ, setQZ] = useState('')
  const [errZ, setErrZ] = useState('')

  // todo el inventario
  const [allRows, setAllRows] = useState([])
  const [loadingA, setLoadingA] = useState(false)
  const [qA, setQA] = useState('')
  const [errA, setErrA] = useState('')

  useEffect(() => {
    (async () => {
      setLoading(true)
      setInvs(await getInventarios())
      setLoading(false)
    })()
  }, [])

  const openInv = useCallback(async (inv) => {
    setSelInv(inv); setView('zonas'); setQZona('')
    setLoadingD(true)
    try { setDetalle(await getInventarioDetalle(inv.id)) }
    finally { setLoadingD(false) }
  }, [])

  const openZona = useCallback(async (z) => {
    setSelZona(z); setView('zona'); setQZ(''); setErrZ(''); setZonaRows([])
    setLoadingZ(true)
    try {
      const rows = await getZonaDetalle(z.id)
      console.log('[Conteos] getZonaDetalle', z.id, '→', rows.length, 'filas', rows)
      setZonaRows(rows)
    } catch (e) {
      console.error('[Conteos] getZonaDetalle error', e)
      setErrZ(e.message || String(e))
    } finally { setLoadingZ(false) }
  }, [])

  const openTodo = useCallback(async () => {
    setView('todo'); setQA(''); setErrA(''); setAllRows([])
    setLoadingA(true)
    try {
      const rows = await getConteosInventario(selInv.id)
      console.log('[Conteos] getConteosInventario', selInv.id, '→', rows.length, 'filas', rows)
      setAllRows(rows)
    } catch (e) {
      console.error('[Conteos] getConteosInventario error', e)
      setErrA(e.message || String(e))
    } finally { setLoadingA(false) }
  }, [selInv])

  const invsFiltradas = useMemo(() => {
    const n = normalize(qInv)
    if (!n) return invs
    return invs.filter(i =>
      normalize(i.nombre).includes(n) ||
      normalize(i.sucursal).includes(n) ||
      normalize(i.deposito).includes(n) ||
      normalize(i.responsable).includes(n)
    )
  }, [invs, qInv])

  const zonasFiltradas = useMemo(() => {
    if (!detalle) return []
    const n = normalize(qZona)
    if (!n) return detalle.zonas
    return detalle.zonas.filter(z => normalize(z.nombre).includes(n) || normalize(z.descripcion).includes(n))
  }, [detalle, qZona])

  const zonaRowsFiltradas = useMemo(
    () => zonaRows.filter(c => matchConteo(c, qZ)),
    [zonaRows, qZ],
  )

  const allRowsFiltradas = useMemo(
    () => allRows.filter(c => matchConteo(c, qA)),
    [allRows, qA],
  )

  // ── breadcrumb ──
  const Crumb = () => {
    const items = [{ label: 'Inventarios', onClick: () => setView('inv') }]
    if (selInv && view !== 'inv') items.push({ label: selInv.nombre, onClick: () => setView('zonas') })
    if (view === 'zona' && selZona) items.push({ label: selZona.nombre, onClick: null })
    if (view === 'todo') items.push({ label: 'Todos los conteos', onClick: null })
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 13, marginBottom: 14 }}>
        {items.map((it, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {it.onClick
              ? <button onClick={it.onClick} style={{ background: 'none', border: 'none', color: B, fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 13 }}>{it.label}</button>
              : <span style={{ color: '#111827', fontWeight: 700 }}>{it.label}</span>}
            {i < items.length - 1 && <span style={{ color: '#9CA3AF' }}>›</span>}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Conteos</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Explorá los conteos por inventario y zona</div>
      </div>

      <Crumb />

      {/* ── Nivel 1: Inventarios ── */}
      {view === 'inv' && (
        <>
          <SearchInput value={qInv} onChange={setQInv} placeholder="Buscar inventario por nombre, sucursal, depósito o responsable..." />
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          ) : invsFiltradas.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 14, background: '#fff', border: '1px solid #E5E7EB' }}>
              {invs.length === 0 ? 'No hay inventarios aún.' : 'Sin resultados.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {invsFiltradas.map(inv => (
                <div
                  key={inv.id}
                  onClick={() => openInv(inv)}
                  style={{
                    background: '#fff',
                    border: '1px solid #E5E7EB',
                    borderLeft: `4px solid ${inv.estado === 'abierto' ? G : '#D1D5DB'}`,
                    padding: '14px 16px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{inv.nombre}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
                      {inv.sucursal}{inv.deposito ? ` · ${inv.deposito}` : ''}
                      {inv.fecha_inicio && ` · ${fmtFecha(inv.fecha_inicio)}`}
                    </div>
                  </div>
                  <span style={{ background: inv.estado === 'abierto' ? GL : '#F3F4F6', color: inv.estado === 'abierto' ? '#065F46' : '#6B7280', padding: '3px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {inv.estado}
                  </span>
                  <span style={{ fontSize: 12, color: B, fontWeight: 600 }}>Abrir →</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Nivel 2: Zonas del inventario ── */}
      {view === 'zonas' && selInv && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <button
              onClick={openTodo}
              style={{ padding: '10px 14px', background: B, border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"><line x1={8} y1={6} x2={21} y2={6}/><line x1={8} y1={12} x2={21} y2={12}/><line x1={8} y1={18} x2={21} y2={18}/><line x1={3} y1={6} x2="3.01" y2={6}/><line x1={3} y1={12} x2="3.01" y2={12}/><line x1={3} y1={18} x2="3.01" y2={18}/></svg>
              Ver todos los conteos
            </button>
          </div>

          <SearchInput value={qZona} onChange={setQZona} placeholder="Buscar zona..." />

          {loadingD ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          ) : zonasFiltradas.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 14, background: '#fff', border: '1px solid #E5E7EB' }}>
              {detalle?.zonas.length === 0 ? 'Este inventario no tiene zonas.' : 'Sin resultados.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {zonasFiltradas.map(z => (
                <div
                  key={z.id}
                  onClick={() => openZona(z)}
                  style={{ background: '#fff', border: `1px solid ${z.finalizada ? '#D1FAE5' : '#E5E7EB'}`, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                >
                  <div style={{ width: 36, height: 36, background: z.finalizada ? GL : BL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={z.finalizada ? G : B} strokeWidth="2.2" strokeLinecap="square"><rect x={3} y={3} width={18} height={18}/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{z.nombre}</div>
                    {z.descripcion && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{z.descripcion}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700, color: z.finalizada ? G : B }}>{z.conteos}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>conteos</div>
                  </div>
                  {z.finalizada && (
                    <span style={{ background: GL, color: '#065F46', border: '1px solid #6EE7B7', padding: '2px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', flexShrink: 0 }}>OK</span>
                  )}
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="square" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Nivel 3: Conteos de una zona ── */}
      {view === 'zona' && selZona && (
        <>
          <SearchInput value={qZ} onChange={setQZ} placeholder="Buscar por producto, código, SKU, usuario..." />
          {errZ && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#DC2626' }}>✕ {errZ}</div>}
          {loadingZ
            ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
            : <ConteosTable rows={zonaRowsFiltradas} showZona={false} />}
        </>
      )}

      {/* ── Nivel alternativo: Todos los conteos del inventario ── */}
      {view === 'todo' && selInv && (
        <>
          <SearchInput value={qA} onChange={setQA} placeholder="Buscar por producto, código, SKU, zona, usuario..." />
          {errA && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#DC2626' }}>✕ {errA}</div>}
          {loadingA
            ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
            : <ConteosTable rows={allRowsFiltradas} showZona={true} />}
        </>
      )}
    </div>
  )
}
