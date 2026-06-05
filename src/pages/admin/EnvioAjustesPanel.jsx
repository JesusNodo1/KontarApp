import { useEffect, useMemo, useState } from 'react'
import { B, BL, G, GL } from '../../constants/theme'
import { enviarAjustesInventario, enviarAjustesInventarioDemo, getAjustesEnviadosIds, getAjustesEnviadosDetalle } from '../../services/apiExternaService'
import { useAuth } from '../../context/AuthContext'
import Spinner from '../../components/Spinner'

// Por default se envía al ERP real. El admin puede activar el toggle "Modo demo"
// al lado del botón si quiere simular antes de mandar de verdad.
const DEMO_DEFAULT = false

/**
 * Panel para enviar al ERP los ajustes del inventario (cerrado).
 * Se renderiza dentro de DiferenciasScreen, encima del DiferenciasPanel.
 *
 * Props:
 *  - inventario: { id, estado, fecha_inicio, deposito_id, ... }
 *  - data:       resultado de getDiferencias({ filas, resumen }) ya cargado por DiferenciasPanel
 */
export default function EnvioAjustesPanel({ inventario, data }) {
  const { user } = useAuth()
  const apiHabilitada = user?.fuente_sync === 'api'
  const cerrado = inventario?.estado === 'cerrado'

  const [enviadosIds, setEnviadosIds] = useState(null) // Set<producto_id>
  const [loadingIds,  setLoadingIds]  = useState(false)
  const [enviando,    setEnviando]    = useState(false)
  const [progress,    setProgress]    = useState(null) // {index,total,exitos,errores,omitidos,...}
  const [resumen,     setResumen]     = useState(null)
  const [errorMsg,    setErrorMsg]    = useState('')
  const [log,         setLog]         = useState([])    // [{producto, mensaje, ok}]
  const [demo,        setDemo]        = useState(DEMO_DEFAULT)
  const [seleccion,   setSeleccion]   = useState(() => new Set()) // Set<producto_id>
  const [openLista,   setOpenLista]   = useState(false)
  const [historial,   setHistorial]   = useState([])    // [{producto_id, producto:{nombre,...}, conteo, sistema, mensaje, ok, sent_at}]
  const [openHist,    setOpenHist]    = useState(false)

  // Carga inicial de IDs ya enviados (en demo no tocamos la DB → set vacío)
  const recargarEnviados = async () => {
    if (!cerrado || !apiHabilitada) return
    if (demo) { setEnviadosIds(new Set()); setHistorial([]); return }
    setLoadingIds(true); setErrorMsg('')
    try {
      const [set, det] = await Promise.all([
        getAjustesEnviadosIds(inventario.id),
        getAjustesEnviadosDetalle(inventario.id),
      ])
      setEnviadosIds(set)
      setHistorial(det)
    } catch (e) {
      setErrorMsg(e.message)
    } finally {
      setLoadingIds(false)
    }
  }
  useEffect(() => { recargarEnviados() /* eslint-disable-next-line */ }, [inventario?.id, cerrado, apiHabilitada, demo])

  // Cuenta de filas que requieren ajuste (dif !== 0 o pendiente)
  const filasAjustables = useMemo(() => {
    if (!data?.filas) return []
    return data.filas.filter(f => (Number(f.diferencia) || 0) !== 0 || f.estado === 'pendiente')
  }, [data])

  // Filas pendientes (todavía no enviadas)
  const filasPendientes = useMemo(() => {
    if (!enviadosIds) return filasAjustables
    return filasAjustables.filter(f => !enviadosIds.has(Number(f.producto_id)))
  }, [filasAjustables, enviadosIds])

  const totalAjustables = filasAjustables.length
  const yaEnviados = totalAjustables - filasPendientes.length
  const pendientes = filasPendientes.length

  // Si cambian las filas (por filtro nuevo, recarga, etc.), saneamos la selección
  useEffect(() => {
    setSeleccion(prev => {
      const valid = new Set(filasPendientes.map(f => Number(f.producto_id)))
      const next = new Set()
      for (const id of prev) if (valid.has(id)) next.add(id)
      return next
    })
  }, [filasPendientes])

  const seleccionados = seleccion.size
  const aEnviar = seleccionados > 0 ? seleccionados : pendientes
  const modoSel  = seleccionados > 0  // si hay marcados, mandamos solo esos

  const handleEnviar = async () => {
    if (!data) return
    if (aEnviar === 0) return

    // Si hay selección, armamos un subset de `data` con sólo esas filas.
    // Si no hay selección, mandamos el `data` original (la función filtra por dif y por enviados).
    const subset = modoSel
      ? { ...data, filas: data.filas.filter(f => seleccion.has(Number(f.producto_id))) }
      : data

    const msgConfirm = demo
      ? `MODO DEMO: simular envío de ${aEnviar} ajuste(s)${modoSel ? ' seleccionado(s)' : ''}? No se llama al ERP ni se inserta en la base.`
      : `Enviar ${aEnviar} ajuste(s)${modoSel ? ' seleccionado(s)' : ''} al ERP? Esta operación no se puede revertir desde la app.`
    if (!confirm(msgConfirm)) return

    setEnviando(true); setErrorMsg(''); setLog([]); setResumen(null)
    setProgress({ index: 0, total: aEnviar, exitos: 0, errores: 0, omitidos: 0 })

    const fn = demo ? enviarAjustesInventarioDemo : enviarAjustesInventario

    try {
      const r = await fn({
        inventario,
        diferencias: subset,
        onProgress: (p) => {
          setProgress(p)
          setLog(prev => [...prev, { producto: p.ultimoProducto, mensaje: p.ultimoMensaje, ok: p.ok }])
        },
      })
      setResumen(r)
      setSeleccion(new Set())
      if (!demo) await recargarEnviados()
    } catch (e) {
      setErrorMsg(e.message)
    } finally {
      setEnviando(false)
    }
  }

  const toggleProd = (pid) => setSeleccion(prev => {
    const s = new Set(prev)
    if (s.has(pid)) s.delete(pid); else s.add(pid)
    return s
  })
  const selTodos    = () => setSeleccion(new Set(filasPendientes.map(f => Number(f.producto_id))))
  const selNinguno  = () => setSeleccion(new Set())

  // ── Casos en los que el panel no se muestra o muestra estados pasivos ──
  if (!apiHabilitada) return null

  if (!cerrado) {
    return (
      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '12px 14px', marginBottom: 14, fontSize: 13, color: '#92400E' }}>
        ⓘ Cerrá el inventario para poder enviar los ajustes al ERP.
      </div>
    )
  }

  if (loadingIds || !data) {
    return (
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Spinner /> <span style={{ fontSize: 13, color: '#6B7280' }}>Verificando ajustes ya enviados…</span>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderTop: `3px solid ${demo ? '#F59E0B' : B}`, marginBottom: 14, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', letterSpacing: '0.02em' }}>Enviar ajustes al ERP</div>
            {demo && (
              <span style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', padding: '1px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Modo demo
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
            <b style={{ color: G }}>{yaEnviados}</b> enviados · <b style={{ color: pendientes > 0 ? '#92400E' : '#6B7280' }}>{pendientes}</b> pendientes · {totalAjustables} con diferencia
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 600,
              color: demo ? '#92400E' : '#6B7280',
              background: demo ? '#FEF3C7' : '#F9FAFB',
              border: `1px solid ${demo ? '#FDE68A' : '#E5E7EB'}`,
              padding: '7px 10px',
              cursor: enviando ? 'not-allowed' : 'pointer',
              userSelect: 'none',
            }}
            title="Si lo activás, simula el envío sin tocar el ERP ni la base."
          >
            <input
              type="checkbox"
              checked={demo}
              disabled={enviando}
              onChange={e => setDemo(e.target.checked)}
              style={{ width: 16, height: 16, cursor: enviando ? 'not-allowed' : 'pointer', accentColor: '#F59E0B' }}
            />
            Modo demo
          </label>
          <button
            onClick={handleEnviar}
            disabled={enviando || aEnviar === 0}
            style={{
              height: 38, padding: '0 16px',
              background: (enviando || aEnviar === 0) ? '#F3F4F6' : G,
              border: 'none',
              color: (enviando || aEnviar === 0) ? '#9CA3AF' : '#fff',
              fontWeight: 700, fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase',
              cursor: (enviando || aEnviar === 0) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {enviando ? <><Spinner /> Enviando ({progress?.index ?? 0}/{progress?.total ?? 0})…</> :
             pendientes === 0 ? '✓ Todo enviado' :
             modoSel ? `Enviar ${seleccionados} seleccionado${seleccionados !== 1 ? 's' : ''}` :
                       `Enviar ${pendientes} pendiente${pendientes !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      {/* Selector de productos pendientes */}
      {pendientes > 0 && !enviando && (
        <div style={{ marginTop: 12, border: '1px solid #E5E7EB', background: '#FAFAFA' }}>
          <button
            onClick={() => setOpenLista(o => !o)}
            style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#374151', fontWeight: 600 }}
          >
            <span>
              {openLista ? '▾' : '▸'} Seleccionar productos específicos
              {seleccionados > 0 && <span style={{ color: G, marginLeft: 8 }}>· {seleccionados} marcado{seleccionados !== 1 ? 's' : ''}</span>}
            </span>
            <span style={{ color: '#9CA3AF', fontSize: 11, fontWeight: 500 }}>
              {seleccionados === 0 ? 'sin selección · se mandarán todos' : 'sólo los marcados'}
            </span>
          </button>

          {openLista && (
            <div style={{ borderTop: '1px solid #E5E7EB', background: '#fff' }}>
              <div style={{ padding: '6px 12px', borderBottom: '1px solid #F3F4F6', display: 'flex', gap: 10, fontSize: 11 }}>
                <button onClick={selTodos}   style={{ background: 'transparent', border: 'none', color: B, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Seleccionar todos</button>
                <button onClick={selNinguno} style={{ background: 'transparent', border: 'none', color: '#6B7280', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Ninguno</button>
              </div>
              <div className="scroll-pc" style={{ maxHeight: 280, overflowY: 'auto', fontSize: 12 }}>
                {filasPendientes.map(f => {
                  const pid = Number(f.producto_id)
                  const checked = seleccion.has(pid)
                  const dif = Number(f.diferencia) || 0
                  const difColor = dif === 0 ? '#6B7280' : dif > 0 ? '#92400E' : '#DC2626'
                  return (
                    <label key={pid} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 60px 60px 64px', alignItems: 'center', padding: '6px 12px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', background: checked ? BL : '#fff' }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleProd(pid)} style={{ cursor: 'pointer' }} />
                      <div style={{ minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 500, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {f.nombre}{f.variante ? <span style={{ color: '#6B7280', fontWeight: 400 }}> · {f.variante}</span> : null}
                        </div>
                        <div style={{ fontSize: 10, color: '#9CA3AF', fontFamily: "'DM Mono',monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {f.codigo_barras || f.sku || '—'}
                          {!f.id_externo && <span style={{ color: '#DC2626', marginLeft: 6 }}>· sin id_externo</span>}
                        </div>
                      </div>
                      <div style={{ fontFamily: "'DM Mono',monospace", color: '#6B7280', textAlign: 'right' }}>{f.teorico}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", color: '#111827', textAlign: 'right' }}>{f.contado}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, textAlign: 'right', color: difColor }}>
                        {dif > 0 ? '+' : ''}{dif}
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Historial de ya enviados — sólo si hay alguno y no estamos en demo */}
      {!demo && historial.length > 0 && !enviando && (
        <div style={{ marginTop: 12, border: '1px solid #E5E7EB', background: '#FAFAFA' }}>
          <button
            onClick={() => setOpenHist(o => !o)}
            style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#374151', fontWeight: 600 }}
          >
            <span>{openHist ? '▾' : '▸'} Historial de ajustes enviados <span style={{ color: G }}>· {historial.length}</span></span>
            <span style={{ color: '#9CA3AF', fontSize: 11, fontWeight: 500 }}>no se reenvían</span>
          </button>
          {openHist && (
            <div className="scroll-pc" style={{ borderTop: '1px solid #E5E7EB', background: '#fff', maxHeight: 280, overflowY: 'auto', fontSize: 11 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 56px 56px 1fr', padding: '6px 12px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9CA3AF' }}>
                <div>Fecha</div><div>Producto</div><div style={{ textAlign: 'right' }}>Cont.</div><div style={{ textAlign: 'right' }}>Teor.</div><div>Mensaje</div>
              </div>
              {historial.map((h, i) => (
                <div key={h.producto_id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 56px 56px 1fr', padding: '6px 12px', borderBottom: i < historial.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'center', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", color: '#6B7280' }}>{h.sent_at ? new Date(h.sent_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                  <div style={{ paddingLeft: 6, minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {h.producto?.nombre || `Producto ${h.producto_id}`}
                      {h.producto?.variante && <span style={{ color: '#6B7280', fontWeight: 400 }}> · {h.producto.variante}</span>}
                    </div>
                    <div style={{ fontFamily: "'DM Mono',monospace", color: '#9CA3AF', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.producto?.codigo_barras || h.producto?.sku || '—'}</div>
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", color: '#111827', textAlign: 'right' }}>{h.conteo}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", color: '#6B7280', textAlign: 'right' }}>{h.sistema}</div>
                  <div style={{ fontSize: 10, color: h.ok ? '#065F46' : '#DC2626', paddingLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.ok ? '✓' : '✗'} {h.mensaje || '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '8px 12px', marginTop: 12, fontSize: 12, color: '#DC2626' }}>✕ {errorMsg}</div>
      )}

      {(enviando || resumen) && progress && (
        <div style={{ marginTop: 12 }}>
          {/* barra de progreso */}
          <div style={{ height: 6, background: '#F3F4F6', position: 'relative', marginBottom: 8 }}>
            <div style={{ width: `${progress.total ? (progress.index / progress.total) * 100 : 0}%`, height: '100%', background: G, transition: 'width .15s' }} />
          </div>
          <div style={{ fontSize: 11, color: '#6B7280', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span><b style={{ color: G }}>✓ {progress.exitos}</b> éxitos</span>
            <span><b style={{ color: '#DC2626' }}>✗ {progress.errores}</b> errores</span>
            <span><b style={{ color: '#92400E' }}>↷ {progress.omitidos}</b> omitidos</span>
          </div>
        </div>
      )}

      {log.length > 0 && (
        <div className="scroll-pc" style={{ marginTop: 10, maxHeight: 220, overflowY: 'auto', border: '1px solid #F3F4F6', background: '#FAFAFA', fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
          {log.map((l, i) => (
            <div key={i} style={{ padding: '5px 10px', borderBottom: i < log.length - 1 ? '1px solid #F3F4F6' : 'none', color: l.ok ? '#065F46' : '#DC2626', display: 'flex', gap: 8 }}>
              <span style={{ flexShrink: 0 }}>{l.ok ? '✓' : '✗'}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{l.producto}</span>
              <span style={{ color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.mensaje}</span>
            </div>
          ))}
        </div>
      )}

      {resumen && !enviando && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: resumen.errores === 0 ? GL : '#FFFBEB', border: `1px solid ${resumen.errores === 0 ? '#6EE7B7' : '#FDE68A'}`, fontSize: 12, color: resumen.errores === 0 ? '#065F46' : '#92400E' }}>
          Resumen: {resumen.exitos} enviados, {resumen.errores} errores, {resumen.omitidos} omitidos (sin id_externo/código). {resumen.errores > 0 && 'Los que fallaron se pueden reintentar — los que se enviaron NO se vuelven a enviar.'}
        </div>
      )}
    </div>
  )
}
