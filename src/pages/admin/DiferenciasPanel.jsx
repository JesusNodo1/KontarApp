import { useState, useEffect, useMemo, useCallback } from 'react'
import { B, BL, G, GL } from '../../constants/theme'
import { getDiferencias, getStockTeoricoStatus, getSucursales, getDepositos } from '../../services/adminService'
import { cargarStockTeoricoDesdeAPI } from '../../services/apiExternaService'
import { useAuth } from '../../context/AuthContext'
import Spinner from '../../components/Spinner'
import { useIsNarrow } from '../../hooks/useIsNarrow'

const norm = s => (s || '').toString().toLowerCase().trim()

const ESTADO_LABEL = {
  'ok':           { label: 'OK',          bg: GL,        color: '#065F46' },
  'pendiente':    { label: 'Pendiente',   bg: '#F3F4F6', color: '#6B7280' },
  'faltante':     { label: 'Faltante',    bg: '#FEF2F2', color: '#DC2626' },
  'sobrante':     { label: 'Sobrante',    bg: '#FEF3C7', color: '#92400E' },
  'no-esperado':  { label: 'No esperado', bg: '#EFF6FF', color: '#1D4ED8' },
}

export default function DiferenciasPanel({ inventario, onData, extraToolbar = null }) {
  const { user } = useAuth()
  const apiHabilitada = user?.fuente_sync === 'api'
  const isNarrow = useIsNarrow()

  const [loading,   setLoading]   = useState(true)
  const [data,      setData]      = useState(null)
  const [status,    setStatus]    = useState({ cargado: false, total: 0 })
  const [filtro,    setFiltro]    = useState('todos')   // todos | ok | faltante | sobrante | no-esperado
  const [busqueda,  setBusqueda]  = useState('')
  const [magMin,    setMagMin]    = useState('')        // magnitud mínima |dif|
  const [variante,  setVariante]  = useState('')        // tipo de producto (variante)
  const [cargando,  setCargando]  = useState(false)
  const [errorMsg,  setErrorMsg]  = useState('')
  const [okMsg,     setOkMsg]     = useState('')
  const [pagina,    setPagina]    = useState(1)
  const POR_PAGINA = 50

  // Selector de sucursal/depósito para comparar contra otro origen
  const [sucursales,  setSucursales]  = useState([])
  const [depositos,   setDepositos]   = useState([])
  const LS_KEY = `dif:lastDep:${inventario.id}`
  const [sucursalSel, setSucursalSel] = useState(null)
  const [depositoSel, setDepositoSel] = useState(null)
  const [origenLabel, setOrigenLabel] = useState('')  // se setea tras cargar

  // Carga sucursales+depositos una vez y resuelve el default
  useEffect(() => {
    if (!apiHabilitada) return
    let cancel = false
    ;(async () => {
      try {
        const [sucs, deps] = await Promise.all([getSucursales(true), getDepositos(true)])
        if (cancel) return
        setSucursales(sucs)
        setDepositos(deps)
        // Default: última selección guardada, si no, el depósito propio del inventario
        const lastId = Number(localStorage.getItem(LS_KEY)) || null
        const defDep = deps.find(d => d.id === lastId)
                    || deps.find(d => d.id === inventario.deposito_id)
                    || null
        if (defDep) {
          setDepositoSel(defDep.id)
          setSucursalSel(defDep.sucursal_id ?? null)
        }
      } catch (e) {
        // no fatal — el usuario verá los selectores vacíos
        console.warn('No se pudieron cargar sucursales/depósitos', e)
      }
    })()
    return () => { cancel = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiHabilitada, inventario.id, inventario.deposito_id])

  const depositosFiltrados = useMemo(() => {
    if (!sucursalSel) return depositos
    return depositos.filter(d => d.sucursal_id === sucursalSel)
  }, [depositos, sucursalSel])

  const load = useCallback(async () => {
    setLoading(true); setErrorMsg('')
    try {
      const st = await getStockTeoricoStatus(inventario.id)
      setStatus(st)
      if (st.cargado) {
        const d = await getDiferencias(inventario.id)
        setData(d)
        onData?.(d)
      } else {
        setData(null)
        onData?.(null)
      }
    } catch (e) {
      setErrorMsg(e.message)
    } finally {
      setLoading(false)
    }
  }, [inventario.id, onData])

  useEffect(() => { load() }, [load])

  const handleCargarApi = async () => {
    const dep = depositos.find(d => d.id === depositoSel)
    const esOtro = depositoSel && inventario.deposito_id && depositoSel !== inventario.deposito_id
    const msg = esOtro
      ? `Cargar stock teórico desde "${dep?.nombre || 'otro depósito'}" (distinto al asignado al inventario)? Reemplaza el snapshot anterior si ya existía.`
      : 'Cargar el stock teórico desde la API externa? Reemplaza el snapshot anterior si ya existía.'
    if (!confirm(msg)) return
    setCargando(true); setErrorMsg(''); setOkMsg('')
    try {
      const r = await cargarStockTeoricoDesdeAPI(inventario.id, depositoSel ? { depositoId: depositoSel } : {})
      if (r.depositoId) localStorage.setItem(LS_KEY, String(r.depositoId))
      const origen = r.depositoNombre || `depósito ext. ${r.deposito}`
      setOrigenLabel(origen)
      const partes = [`✓ ${r.total} productos cargados desde ${origen}`]
      if (r.sinProducto > 0) partes.push(`${r.sinProducto} sin match en catálogo`)
      setOkMsg(partes.join(' · '))
      await load()
    } catch (e) {
      setErrorMsg(e.message)
    } finally {
      setCargando(false)
    }
  }

  const variantes = useMemo(() => {
    if (!data) return []
    const set = new Set()
    for (const f of data.filas) { if (f.variante) set.add(f.variante) }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [data])

  const filtradas = useMemo(() => {
    if (!data) return []
    const n = norm(busqueda)
    const mag = magMin === '' ? null : Math.abs(Number(magMin))
    return data.filas.filter(f => {
      if (filtro !== 'todos' && f.estado !== filtro) return false
      if (variante && (f.variante || '') !== variante) return false
      if (mag != null && !Number.isNaN(mag) && Math.abs(Number(f.diferencia) || 0) < mag) return false
      if (!n) return true
      return (
        norm(f.nombre).includes(n) ||
        norm(f.variante).includes(n) ||
        norm(f.codigo_barras).includes(n) ||
        norm(f.sku).includes(n)
      )
    })
  }, [data, filtro, busqueda, magMin, variante])

  useEffect(() => { setPagina(1) }, [filtro, busqueda, magMin, variante])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const paginaAct    = Math.min(pagina, totalPaginas)
  const inicio       = (paginaAct - 1) * POR_PAGINA
  const paginadas    = filtradas.slice(inicio, inicio + POR_PAGINA)

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
  }

  // Selector reusable de sucursal → depósito (origen de comparación)
  const renderSelectorOrigen = (compact = false) => (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <select
        value={sucursalSel ?? ''}
        onChange={e => {
          const v = e.target.value ? Number(e.target.value) : null
          setSucursalSel(v)
          // Si el depósito actual no pertenece a la sucursal elegida, reset
          if (v && depositoSel) {
            const dep = depositos.find(d => d.id === depositoSel)
            if (dep && dep.sucursal_id !== v) setDepositoSel(null)
          }
        }}
        style={{ height: compact ? 38 : 36, padding: '0 8px', border: '2px solid #E5E7EB', background: '#fff', fontSize: 12, minWidth: 130 }}
        title="Sucursal de origen para la comparación"
      >
        <option value="">— Sucursal —</option>
        {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select>
      <select
        value={depositoSel ?? ''}
        onChange={e => {
          const v = e.target.value ? Number(e.target.value) : null
          setDepositoSel(v)
          const dep = depositos.find(d => d.id === v)
          if (dep && dep.sucursal_id) setSucursalSel(dep.sucursal_id)
        }}
        style={{ height: compact ? 38 : 36, padding: '0 8px', border: '2px solid #E5E7EB', background: '#fff', fontSize: 12, minWidth: 150 }}
        title="Depósito a comparar contra el conteo"
      >
        <option value="">— Depósito —</option>
        {depositosFiltrados.map(d => (
          <option key={d.id} value={d.id} disabled={!d.id_externo}>
            {d.nombre}{!d.id_externo ? ' (sin ID externo)' : ''}
          </option>
        ))}
      </select>
    </div>
  )

  // ── Sin teórico cargado: pantalla de carga inicial ──
  if (!status.cargado) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center', background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>
          Aún no se cargó el stock teórico de este inventario.
        </div>
        {apiHabilitada ? (
          <>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
              {renderSelectorOrigen(true)}
            </div>
            <button
              onClick={handleCargarApi}
              disabled={cargando || !depositoSel}
              style={{ padding: '10px 18px', background: (cargando || !depositoSel) ? '#F3F4F6' : G, border: 'none', color: (cargando || !depositoSel) ? '#9CA3AF' : '#fff', fontWeight: 700, fontSize: 13, cursor: (cargando || !depositoSel) ? 'not-allowed' : 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              title={!depositoSel ? 'Elegí un depósito para comparar' : ''}
            >
              {cargando ? <><Spinner /> Cargando...</> : 'Cargar desde API'}
            </button>
            {!depositoSel && (
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
                Elegí el depósito a comparar contra el conteo.
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>
            Este cliente no tiene API habilitada. Subir CSV/Excel — feature pendiente.
          </div>
        )}
        {errorMsg && <div style={{ marginTop: 12, color: '#DC2626', fontSize: 12 }}>✕ {errorMsg}</div>}
      </div>
    )
  }

  const r = data?.resumen || {}
  const depSel       = depositos.find(d => d.id === depositoSel)
  const esOrigenOtro = depositoSel && inventario.deposito_id && depositoSel !== inventario.deposito_id

  return (
    <div>
      {/* mensajes */}
      {errorMsg && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#DC2626' }}>✕ {errorMsg}</div>}
      {okMsg && <div style={{ background: GL, border: '1px solid #6EE7B7', padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#065F46' }}>{okMsg}</div>}
      {esOrigenOtro && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#92400E' }}>
          ⚠ Comparando contra <b>{depSel?.nombre}</b> (distinto del depósito asignado al inventario "{inventario.deposito || '—'}"). Clic en <b>Recargar API</b> para aplicar.
        </div>
      )}

      {/* resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { lbl: 'Total',         val: r.total,         color: '#111827' },
          { lbl: 'Total Conteo',  val: r.totalContado,  color: G },
          { lbl: 'OK',            val: r.ok,            color: '#065F46' },
          { lbl: 'Pendientes',    val: r.pendientes,    color: '#6B7280' },
          { lbl: 'Faltantes',     val: r.faltantes,     color: '#DC2626' },
          { lbl: 'Sobrantes',     val: r.sobrantes,     color: '#92400E' },
        ].map(x => (
          <div key={x.lbl} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 4 }}>{x.lbl}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 700, color: x.color }}>{x.val ?? 0}</div>
          </div>
        ))}
      </div>

      {/* acciones + búsqueda */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text" placeholder="Buscar por nombre, código, SKU..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ flex: 1, minWidth: 220, height: 38, border: '2px solid #E5E7EB', padding: '0 12px', fontSize: 13, background: '#fff' }}
        />
        <input
          type="number" min="0" inputMode="numeric"
          placeholder="|dif| ≥"
          value={magMin} onChange={e => setMagMin(e.target.value)}
          style={{ width: 110, height: 38, border: `2px solid ${magMin ? B : '#E5E7EB'}`, background: magMin ? BL : '#fff', padding: '0 10px', fontSize: 13, fontFamily: "'DM Mono',monospace", color: '#111827' }}
          title="Magnitud mínima de la diferencia (|contado − teórico|)"
        />
        <select
          value={variante} onChange={e => setVariante(e.target.value)}
          style={{ height: 38, padding: '0 10px', border: `2px solid ${variante ? B : '#E5E7EB'}`, background: variante ? BL : '#fff', fontSize: 12, fontWeight: 600, color: variante ? '#111827' : '#6B7280', minWidth: 150, cursor: 'pointer' }}
          title="Filtrar por variante (tipo de producto)"
        >
          <option value="">Todas las variantes</option>
          {variantes.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        {apiHabilitada && renderSelectorOrigen(true)}
        {apiHabilitada && (
          <button
            onClick={handleCargarApi} disabled={cargando || !depositoSel}
            style={{ height: 38, padding: '0 14px', background: '#fff', border: `2px solid ${G}`, color: (cargando || !depositoSel) ? '#9CA3AF' : G, fontWeight: 700, fontSize: 12, cursor: (cargando || !depositoSel) ? 'not-allowed' : 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}
            title={!depositoSel ? 'Elegí un depósito' : 'Volver a cargar el stock desde la API (usa la sucursal/depósito elegidos)'}
          >
            {cargando ? <><Spinner /> Recargando...</> : '↻ Recargar API'}
          </button>
        )}
        {extraToolbar}
      </div>

      {/* filtros */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {[
          { k: 'todos',       l: `Todos (${r.total ?? 0})` },
          { k: 'pendiente',   l: `Pendientes (${r.pendientes ?? 0})` },
          { k: 'faltante',    l: `Faltantes (${r.faltantes ?? 0})` },
          { k: 'sobrante',    l: `Sobrantes (${r.sobrantes ?? 0})` },
          { k: 'no-esperado', l: `No esperados (${r.noEsperados ?? 0})` },
          { k: 'ok',          l: `OK (${r.ok ?? 0})` },
        ].map(f => {
          const a = filtro === f.k
          return (
            <button key={f.k}
              onClick={() => setFiltro(f.k)}
              style={{ padding: '6px 12px', background: a ? B : '#fff', border: `1px solid ${a ? B : '#E5E7EB'}`, color: a ? '#fff' : '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >{f.l}</button>
          )
        })}
      </div>

      {/* tabla */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
        <div className="scroll-pc" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#CBD5E1 #F3F4F6', scrollBehavior: 'smooth' }}>
        {!isNarrow && (
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 70px 70px 80px 90px', padding: '8px 12px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0, zIndex: 2 }}>
            {['Código', 'Producto', 'Teórico', 'Contado', 'Diferencia', 'Estado'].map((h, i) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9CA3AF', textAlign: i >= 2 && i <= 4 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>
        )}
        {paginadas.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Sin resultados.</div>
        ) : paginadas.map((f, i) => {
          const e = ESTADO_LABEL[f.estado]
          const difColor = f.diferencia === 0 ? '#065F46' : f.diferencia > 0 ? '#92400E' : '#DC2626'
          return isNarrow ? (
            // ── Card mobile ──
            <div key={f.producto_id} style={{ padding: '12px 14px', borderBottom: i < paginadas.length - 1 ? '1px solid #F3F4F6' : 'none', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: B, fontWeight: 600, background: BL, border: '1px solid #BFDBFE', padding: '2px 6px', display: 'inline-block', marginBottom: 4 }}>{f.codigo_barras || '—'}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', lineHeight: 1.3 }}>{f.nombre}{f.variante && <span style={{ color: '#6B7280', fontWeight: 400 }}> · {f.variante}</span>}</div>
                </div>
                <span style={{ background: e.bg, color: e.color, padding: '3px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{e.label}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: 11 }}>
                <div style={{ background: '#F9FAFB', padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ color: '#9CA3AF', fontWeight: 700, fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Teórico</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: '#374151', fontSize: 14 }}>{f.teorico}</div>
                </div>
                <div style={{ background: '#F9FAFB', padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ color: '#9CA3AF', fontWeight: 700, fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Contado</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: '#111827', fontSize: 14 }}>{f.contado}</div>
                </div>
                <div style={{ background: '#F9FAFB', padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ color: '#9CA3AF', fontWeight: 700, fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Diferencia</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: difColor, fontSize: 14 }}>{f.diferencia > 0 ? '+' : ''}{f.diferencia}</div>
                </div>
              </div>
            </div>
          ) : (
            // ── Tabla desktop ──
            <div key={f.producto_id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 70px 70px 80px 90px', padding: '9px 12px', borderBottom: i < paginadas.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'center', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: B, fontWeight: 600, background: BL, border: '1px solid #BFDBFE', padding: '2px 5px', display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.codigo_barras || '—'}</div>
              <div style={{ paddingLeft: 8, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nombre}{f.variante && <span style={{ color: '#6B7280', fontWeight: 400 }}> · {f.variante}</span>}</div>
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: '#6B7280', textAlign: 'right' }}>{f.teorico}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: '#111827', textAlign: 'right' }}>{f.contado}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, textAlign: 'right', color: difColor }}>
                {f.diferencia > 0 ? '+' : ''}{f.diferencia}
              </div>
              <div>
                <span style={{ background: e.bg, color: e.color, padding: '2px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{e.label}</span>
              </div>
            </div>
          )
        })}
        </div>

        {filtradas.length > POR_PAGINA && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#F9FAFB', borderTop: '1px solid #E5E7EB', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11, color: '#6B7280' }}>
              <b>{inicio + 1}</b>–<b>{Math.min(inicio + POR_PAGINA, filtradas.length)}</b> de <b>{filtradas.length}</b>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={paginaAct === 1} style={{ padding: '5px 10px', border: '1px solid #E5E7EB', background: paginaAct === 1 ? '#F3F4F6' : '#fff', color: paginaAct === 1 ? '#9CA3AF' : '#374151', fontSize: 11, fontWeight: 600, cursor: paginaAct === 1 ? 'not-allowed' : 'pointer' }}>‹</button>
              <span style={{ padding: '5px 10px', fontSize: 11, color: '#111827', fontWeight: 700, background: BL, border: `1px solid ${B}33` }}>{paginaAct}/{totalPaginas}</span>
              <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={paginaAct === totalPaginas} style={{ padding: '5px 10px', border: '1px solid #E5E7EB', background: paginaAct === totalPaginas ? '#F3F4F6' : '#fff', color: paginaAct === totalPaginas ? '#9CA3AF' : '#374151', fontSize: 11, fontWeight: 600, cursor: paginaAct === totalPaginas ? 'not-allowed' : 'pointer' }}>›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
