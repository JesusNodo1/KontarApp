import { useEffect, useMemo, useState } from 'react'
import { B, BL, G, GL } from '../../constants/theme'
import { enviarAjustesInventario, enviarAjustesInventarioDemo, getAjustesEnviadosIds } from '../../services/apiExternaService'
import { useAuth } from '../../context/AuthContext'
import Spinner from '../../components/Spinner'

// Demo activado por default mientras no esté la tabla ajustes_enviados ni el Edge Function final deployado.
// Cambialo a false (o usá el toggle en el panel) cuando quieras probar el envío real.
const DEMO_DEFAULT = true

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

  // Carga inicial de IDs ya enviados (en demo no tocamos la DB → set vacío)
  const recargarEnviados = async () => {
    if (!cerrado || !apiHabilitada) return
    if (demo) { setEnviadosIds(new Set()); return }
    setLoadingIds(true); setErrorMsg('')
    try {
      const set = await getAjustesEnviadosIds(inventario.id)
      setEnviadosIds(set)
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

  const totalAjustables = filasAjustables.length
  const yaEnviados = enviadosIds ? filasAjustables.filter(f => enviadosIds.has(Number(f.producto_id))).length : 0
  const pendientes = totalAjustables - yaEnviados

  const handleEnviar = async () => {
    if (!data) return
    if (pendientes === 0) return
    const msgConfirm = demo
      ? `MODO DEMO: simular envío de ${pendientes} ajuste(s)? No se llama al ERP ni se inserta en la base.`
      : `Enviar ${pendientes} ajuste(s) al ERP? Esta operación no se puede revertir desde la app.`
    if (!confirm(msgConfirm)) return

    setEnviando(true); setErrorMsg(''); setLog([]); setResumen(null)
    setProgress({ index: 0, total: pendientes, exitos: 0, errores: 0, omitidos: 0 })

    const fn = demo ? enviarAjustesInventarioDemo : enviarAjustesInventario

    try {
      const r = await fn({
        inventario,
        diferencias: data,
        onProgress: (p) => {
          setProgress(p)
          setLog(prev => [...prev, { producto: p.ultimoProducto, mensaje: p.ultimoMensaje, ok: p.ok }])
        },
      })
      setResumen(r)
      if (!demo) await recargarEnviados()
    } catch (e) {
      setErrorMsg(e.message)
    } finally {
      setEnviando(false)
    }
  }

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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6B7280', marginTop: 6, cursor: enviando ? 'not-allowed' : 'pointer' }}>
            <input type="checkbox" checked={demo} disabled={enviando} onChange={e => setDemo(e.target.checked)} />
            Modo demo (simulado, sin tocar el ERP ni la DB)
          </label>
        </div>
        <button
          onClick={handleEnviar}
          disabled={enviando || pendientes === 0}
          style={{
            height: 38, padding: '0 16px',
            background: (enviando || pendientes === 0) ? '#F3F4F6' : G,
            border: 'none',
            color: (enviando || pendientes === 0) ? '#9CA3AF' : '#fff',
            fontWeight: 700, fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase',
            cursor: (enviando || pendientes === 0) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {enviando ? <><Spinner /> Enviando ({progress?.index ?? 0}/{progress?.total ?? 0})…</> :
           pendientes === 0 ? '✓ Todo enviado' : `Enviar ${pendientes} pendiente${pendientes !== 1 ? 's' : ''}`}
        </button>
      </div>

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
