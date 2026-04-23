import { useState, useRef, useCallback, useEffect } from 'react'
import { B, BD, BL, G, GD, GL } from '../../../constants/theme'
import { bxCod } from '../../../services/productService'
import { loadZx } from '../../../services/scanner'
import { getConteosPorZona, upsertConteo, deleteConteo } from '../../../services/conteoService'
import Spinner from '../../../components/Spinner'
import ModalCam from './ModalCam'
import ModalBusqueda from './ModalBusqueda'

const sl = ms => new Promise(r => setTimeout(r, ms))

// Crea el AudioContext una vez y lo reutiliza para evitar bloqueos por política de autoplay
let _actx = null
function getCtx() {
  if (!_actx || _actx.state === 'closed') {
    _actx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (_actx.state === 'suspended') _actx.resume()
  return _actx
}

function playBeep(type) {
  try {
    // Vibración háptica — funciona incluso con el speaker tapado por la funda del colector
    if ('vibrate' in navigator) {
      navigator.vibrate(type === 'err' ? [80, 40, 80] : type === 'sum' ? [30, 30, 30] : 40)
    }
    const ctx = getCtx()
    const t = ctx.currentTime
    if (type === 'ok' || type === 'sum') {
      // 'ok' (nuevo) → ascendente 1000→1800; 'sum' (duplicado) → descendente 1800→1000
      const [f1, f2] = type === 'ok' ? [1000, 1800] : [1800, 1000]
      const o1 = ctx.createOscillator(), g1 = ctx.createGain()
      o1.connect(g1); g1.connect(ctx.destination)
      o1.type = 'square'; o1.frequency.value = f1
      g1.gain.setValueAtTime(1.0, t); g1.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
      o1.start(t); o1.stop(t + 0.09)
      const o2 = ctx.createOscillator(), g2 = ctx.createGain()
      o2.connect(g2); g2.connect(ctx.destination)
      o2.type = 'square'; o2.frequency.value = f2
      g2.gain.setValueAtTime(1.0, t + 0.1); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
      o2.start(t + 0.1); o2.stop(t + 0.22)
    } else {
      const osc = ctx.createOscillator(), gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sawtooth'; osc.frequency.value = 260
      gain.gain.setValueAtTime(1.0, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
      osc.start(t); osc.stop(t + 0.4)
    }
  } catch {}
}

export default function ConteoScreen({ zona, inv, onBack, onZonaFinalizada, user }) {
  const [sub,        setSub]        = useState('conteo')
  const [modo,       setModo]       = useState('unitario')
  const [query,      setQuery]      = useState('')
  const [prod,       setProd]       = useState(null)
  const [cantidad,   setCantidad]   = useState(1)
  const [conteos,    setConteos]    = useState([])
  const conteosRef = useRef([])
  const [loadingC,   setLoadingC]   = useState(true)
  const [buscando,   setBuscando]   = useState(false)
  const [noEnc,      setNoEnc]      = useState(false)
  const [flash,      setFlash]      = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [mOpen,      setMOpen]      = useState(false)
  const [mCodInicial,setMCodInicial]= useState('')
  const [camO,       setCamO]       = useState(false)
  const [camE,       setCamE]       = useState('')
  const [camR,       setCamR]       = useState(false)
  const [camLast,    setCamLast]    = useState(null)
  const [dupWarning, setDupWarning] = useState(null)  // { prod, existente, nueva }
  const [rView,      setRView]      = useState('unitario') // subvista reporte: 'unitario' | 'total'
  const [scans,      setScans]      = useState([])         // historial de scans de la sesión (no persistido)
  const [undoing,    setUndoing]    = useState(false)

  const vidRef     = useRef(null)
  const rdrRef     = useRef(null)
  const inpRef     = useRef(null)
  const coolRef    = useRef(false)
  const camProcRef = useRef(null)
  const procCodRef = useRef(null)

  // Mantener ref sincronizada para leer en callbacks async sin stale closure
  useEffect(() => { conteosRef.current = conteos }, [conteos])

  // Cargar conteos existentes al entrar en la zona
  useEffect(() => {
    setLoadingC(true)
    getConteosPorZona(zona.id)
      .then(data => setConteos(data))
      .catch(() => setConteos([]))
      .finally(() => setLoadingC(false))
  }, [zona.id])

  // Wake Lock: mantener la pantalla del colector encendida durante el conteo
  useEffect(() => {
    let wakeLock = null
    let released = false
    const request = async () => {
      try {
        if (released || !('wakeLock' in navigator)) return
        wakeLock = await navigator.wakeLock.request('screen')
        wakeLock.addEventListener('release', () => { wakeLock = null })
      } catch {}
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !wakeLock && !released) request()
    }
    request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisible)
      wakeLock?.release?.().catch(() => {})
      wakeLock = null
    }
  }, [])

  const tFlash = () => { setFlash(true); setTimeout(() => setFlash(false), 500) }

  // Auto-focus del input del scanner.
  // El focus se hace con delay para quedar FUERA de la "user activation"
  // de Chromium: sin activación del usuario en curso, element.focus() enfoca
  // el input pero no despliega el teclado virtual en Android.
  // `long=true` → delay más largo, usado solo en el primer focus después de
  // montar la pantalla. Cubre el caso de re-entrada tras back-button, donde
  // los taps recientes de navegación mantienen la "transient activation"
  // activa por varios cientos de ms.
  const focusTimerRef = useRef(null)
  const focusScan = useCallback((long = false) => {
    clearTimeout(focusTimerRef.current)
    focusTimerRef.current = setTimeout(() => {
      try { inpRef.current?.focus({ preventScroll: true }) } catch {}
    }, long ? 750 : 350)
  }, [])

  // Limpia timer pendiente al desmontar para que no dispare sobre un input viejo
  useEffect(() => () => clearTimeout(focusTimerRef.current), [])

  const firstFocusRef = useRef(true)
  useEffect(() => {
    if (loadingC || sub !== 'conteo' || mOpen || camO || dupWarning) return
    focusScan(firstFocusRef.current)
    firstFocusRef.current = false
  }, [loadingC, sub, mOpen, camO, dupWarning, focusScan])

  // Guardar en DB y actualizar estado local.
  // increment=true  → suma c a la cantidad existente (modo unitario)
  // increment=false → reemplaza con c (modo total)
  // Devuelve { prev, next } para que el caller pueda loggear el evento y revertirlo después.
  const reg = useCallback(async (p, c, increment = false) => {
    const existing = conteosRef.current.find(x => x.producto_id === p.id)
    const prev = existing?.cantidad ?? 0
    const finalCantidad = increment ? prev + c : c
    // Optimistic update
    setConteos(prevList => {
      const i = prevList.findIndex(x => x.producto_id === p.id)
      const item = { id: p.id, producto_id: p.id, nombre: p.nombre, variante: p.variante, sku: p.sku, cantidad: finalCantidad, ts: new Date() }
      if (i !== -1) {
        const cp = [...prevList]
        const [it] = cp.splice(i, 1)
        it.cantidad = finalCantidad; it.ts = new Date()
        return [it, ...cp]
      }
      return [item, ...prevList]
    })
    // Persist to Supabase
    try {
      await upsertConteo({
        zona_id:      zona.id,
        inventario_id: inv.id,
        producto_id:  p.id,
        usuario_id:   user.id,
        cantidad:     finalCantidad,
      })
    } catch (e) {
      console.error('[ConteoScreen] upsertConteo error:', e)
    }
    return { prev, next: finalCantidad }
  }, [zona.id, inv.id, user.id])

  // Helper: registra + agrega entrada al historial de scans para poder deshacer.
  const regAndLog = useCallback(async (p, c, increment = false) => {
    const { prev, next } = await reg(p, c, increment)
    setScans(s => [{
      id:          `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      producto_id: p.id,
      nombre:      p.nombre,
      variante:    p.variante,
      sku:         p.sku,
      delta:       next - prev,
      prev,
      next,
      ts:          new Date(),
    }, ...s])
    return { prev, next }
  }, [reg])

  // Deshacer el último scan de la sesión: restaura la cantidad al valor previo.
  const undoLast = useCallback(async () => {
    if (scans.length === 0 || undoing) return
    const last = scans[0]
    setUndoing(true)
    // Optimistic state update
    setConteos(prev => {
      if (last.prev === 0) return prev.filter(x => x.producto_id !== last.producto_id)
      const i = prev.findIndex(x => x.producto_id === last.producto_id)
      if (i === -1) return prev
      const cp = [...prev]
      cp[i] = { ...cp[i], cantidad: last.prev, ts: new Date() }
      return cp
    })
    try {
      if (last.prev === 0) {
        await deleteConteo({ zona_id: zona.id, producto_id: last.producto_id })
      } else {
        await upsertConteo({
          zona_id:       zona.id,
          inventario_id: inv.id,
          producto_id:   last.producto_id,
          usuario_id:    user.id,
          cantidad:      last.prev,
        })
      }
    } catch (e) {
      console.error('[ConteoScreen] undoLast error:', e)
    }
    setScans(s => s.slice(1))
    setUndoing(false)
  }, [scans, undoing, zona.id, inv.id, user.id])

  /* ── procesamiento de código desde cámara (ref para evitar stale closure) ── */
  camProcRef.current = async cod => {
    if (!cod?.trim()) return
    const p = await bxCod(cod.trim())
    if (!p) {
      playBeep('err')
      cerrarCam()
      setMCodInicial(cod.trim()); setMOpen(true)
      return
    }
    if (modo === 'total') {
      // Total: cerrar cámara y mostrar tarjeta para ingresar cantidad
      // Cerrar cámara con demora para que el beep arranque antes de liberar el MediaStream
      playBeep('ok')
      setTimeout(cerrarCam, 250)
      setProd(p); setCantidad(1); setQuery(cod.trim())
    } else {
      // Unitario: +1 directo, cámara sigue abierta
      const isDup = !!conteosRef.current.find(x => x.producto_id === p.id)
      playBeep(isDup ? 'sum' : 'ok'); tFlash()
      setCamLast({ nombre: p.nombre, variante: p.variante, sku: p.sku, raw: cod.trim() })
      await regAndLog(p, 1, true)
    }
  }

  /* ── activar autofocus continuo en el track de video ── */
  const activarAutofocus = track => {
    if (!track) return
    const caps = track.getCapabilities?.() || {}
    if (caps.focusMode?.includes('continuous')) {
      track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {})
    }
  }

  /* ── cámara ── */
  const abrirCam = useCallback(async () => {
    // Pre-calentar AudioContext dentro del gesto del usuario
    // para que los beeps del callback del escáner puedan sonar en iOS Safari
    try { getCtx() } catch {}
    setCamE(''); setCamO(true); setCamR(false); setCamLast(null)
    const mod = await loadZx()
    if (!mod) { setCamE('Error al cargar librería de escaneo.'); return }
    const { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } = mod

    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
      BarcodeFormat.CODE_128, BarcodeFormat.CODE_39,
      BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
      BarcodeFormat.QR_CODE,
    ])
    const r = new BrowserMultiFormatReader(hints)
    rdrRef.current = r
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Cámara no disponible en este dispositivo.')
      setCamR(true)
      await r.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: 'environment' },
            width:      { min: 640, ideal: 1280 },
            height:     { min: 480, ideal: 720  },
            frameRate:  { min: 15,  ideal: 30   },
          },
        },
        vidRef.current,
        (res) => {
          if (!res || coolRef.current) return
          coolRef.current = true
          setTimeout(() => { coolRef.current = false }, 600)
          camProcRef.current(res.getText())
        }
      )
      const track = vidRef.current?.srcObject?.getVideoTracks?.()?.[0]
      activarAutofocus(track)
    } catch (e) { setCamE(e.message || 'Error de cámara.') }
  }, [])

  const cerrarCam = useCallback(() => {
    rdrRef.current?.reset(); rdrRef.current = null
    coolRef.current = false
    setCamO(false); setCamR(false); setCamLast(null)
  }, [])

  useEffect(() => () => rdrRef.current?.reset(), [])

  // Intercepta el botón "atrás" del colector/navegador para cerrar overlays
  // internos (cámara, modal de búsqueda, aviso de duplicado, sub-vista reporte)
  // en vez de salir de la pantalla de conteo.
  // Todos los estados pusheados incluyen `kontar: 'conteo'` para que el handler
  // de CounterApp no navegue a inventario cuando hacemos pop.
  const pushOverlay = (marker) => {
    window.history.pushState({ kontar: 'conteo', overlay: marker }, '')
  }
  const consumeOverlay = (marker) => {
    if (window.history.state?.overlay === marker) window.history.back()
  }

  useEffect(() => {
    if (!camO) return
    pushOverlay('cam')
    const onPop = () => cerrarCam()
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      consumeOverlay('cam')
    }
  }, [camO, cerrarCam])

  useEffect(() => {
    if (!mOpen) return
    pushOverlay('busqueda')
    const onPop = () => { setMOpen(false); setMCodInicial('') }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      consumeOverlay('busqueda')
    }
  }, [mOpen])

  useEffect(() => {
    if (!dupWarning) return
    pushOverlay('dup')
    const onPop = () => setDupWarning(null)
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      consumeOverlay('dup')
    }
  }, [dupWarning])

  useEffect(() => {
    if (sub !== 'reporte') return
    pushOverlay('reporte')
    const onPop = () => setSub('conteo')
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      consumeOverlay('reporte')
    }
  }, [sub])

  /* ── búsqueda por código ── */
  const procCod = useCallback(async cod => {
    if (!cod?.trim()) return
    setBuscando(true); setNoEnc(false)
    const p = await bxCod(cod)
    setBuscando(false)
    if (!p) { playBeep('err'); setMCodInicial(cod.trim()); setMOpen(true); setQuery(''); return }
    // Unitario → +1 directo; Total → muestra tarjeta para ingresar cantidad exacta
    if (modo === 'unitario') {
      const isDup = !!conteosRef.current.find(x => x.producto_id === p.id)
      playBeep(isDup ? 'sum' : 'ok'); tFlash()
      await sl(120); await regAndLog(p, 1, true)
      setQuery(''); focusScan()
    }
    else { setProd(p); setCantidad(1); setQuery(cod) }
  }, [modo, regAndLog])

  // Mantener la ref al último procCod para que el listener global pueda llamarlo sin TDZ
  useEffect(() => { procCodRef.current = procCod }, [procCod])

  const handleConf = async () => {
    if (!prod || cantidad < 1) return
    const existing = conteosRef.current.find(x => x.producto_id === prod.id)
    if (existing) {
      // Ya tiene conteo en esta zona → advertencia antes de sumar
      setDupWarning({ prod, existente: existing.cantidad, nueva: cantidad })
      return
    }
    setConfirming(true)
    await regAndLog(prod, cantidad, false)
    playBeep('ok'); tFlash()
    setProd(null); setQuery(''); setCantidad(1); setConfirming(false)
    focusScan()
  }

  const handleSumarDup = async () => {
    const { prod: p, existente, nueva } = dupWarning
    setDupWarning(null)
    setConfirming(true)
    await regAndLog(p, existente + nueva, false)
    playBeep('sum'); tFlash()
    setProd(null); setQuery(''); setCantidad(1); setConfirming(false)
    focusScan()
  }

  /* ── selección desde modal ── */
  const handleSelModal = async (p, cant = 1, esNuevo = false) => {
    if (esNuevo) {
      await regAndLog(p, cant); playBeep('ok'); tFlash()
      setMOpen(false); setProd(null); setQuery(''); setCantidad(1)
      focusScan(); return
    }
    setProd(p); setQuery(p.sku); setCantidad(1); setModo('total'); setMOpen(false)
  }

  /* ── finalizar zona ── */
  const handleFinalizarZona = async () => {
    setSaving(true)
    try {
      await onZonaFinalizada(zona.id)
      onBack()
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const totalU  = conteos.reduce((s, c) => s + c.cantidad, 0)
  const ultimo  = conteos[0] || null
  const fmtH    = ts => ts.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  const handleBack = () => { if (sub === 'reporte') setSub('conteo'); else onBack() }

  if (loadingC) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3F4F6' }}>
        <div className="spin" style={{ width: 24, height: 24, border: '3px solid #E5E7EB', borderTopColor: B, borderRadius: '50%' }} />
      </div>
    )
  }

  return (
    <div style={{ background: '#F3F4F6', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {flash && <div className="flash" />}
      {camO  && <ModalCam vidRef={vidRef} camR={camR} camE={camE} onCerrar={cerrarCam} lastScan={camLast} />}
      {mOpen && <ModalBusqueda onSeleccionar={handleSelModal} onCerrar={() => { setMOpen(false); setMCodInicial('') }} codigoInicial={mCodInicial} />}

      {/* ── Modal advertencia conteo duplicado ── */}
      {dupWarning && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setDupWarning(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
          <div style={{ position: 'relative', background: '#fff', padding: '20px 16px', paddingBottom: 'max(env(safe-area-inset-bottom),20px)', borderTop: '3px solid #F59E0B' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="square"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#92400E' }}>Producto ya contado en esta zona</div>
            </div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16, paddingLeft: 26 }}>
              {dupWarning.prod.nombre}{dupWarning.prod.variante ? ` — ${dupWarning.prod.variante}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Conteo actual', value: dupWarning.existente, color: B, bg: BL },
                { label: 'Cantidad nueva', value: dupWarning.nueva, color: '#D97706', bg: '#FFFBEB' },
                { label: 'Total sumado', value: dupWarning.existente + dupWarning.nueva, color: G, bg: GL },
              ].map(({ label, value, color, bg }) => (
                <div key={label} style={{ flex: 1, background: bg, padding: '10px 6px', textAlign: 'center' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 3, lineHeight: 1.3 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDupWarning(null)} style={{ flex: 1, padding: '14px 0', background: '#F3F4F6', border: 'none', fontWeight: 700, fontSize: 13, color: '#374151', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Cancelar
              </button>
              <button onClick={handleSumarDup} style={{ flex: 2, padding: '14px 0', background: G, border: 'none', fontWeight: 700, fontSize: 13, color: '#fff', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"><path d="M20 6L9 17l-5-5"/></svg>
                Sumar · {dupWarning.existente + dupWarning.nueva} uds.
              </button>
            </div>
          </div>
        </div>
      )}

      {/* header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '12px 14px', paddingTop: 'max(env(safe-area-inset-top),12px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={handleBack} style={{ background: B, border: 'none', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 22, flexShrink: 0 }}>‹</button>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', lineHeight: 1.2 }}>{sub === 'reporte' ? 'Productos contados' : zona.nombre}</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{sub === 'reporte' ? `${conteos.length} items · ${totalU} uds.` : inv.sucursal}</div>
          </div>
        </div>
        <button
          onClick={() => setSub(sub === 'reporte' ? 'conteo' : 'reporte')}
          style={{ background: sub === 'reporte' ? `${B}22` : GL, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', border: sub === 'reporte' ? `1.5px solid ${B}44` : 'none', cursor: 'pointer', position: 'relative', flexShrink: 0 }}
        >
          {sub === 'reporte'
            ? <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth="2.2" strokeLinecap="square"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>
            : <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2.2" strokeLinecap="square"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
          }
          {conteos.length > 0 && sub !== 'reporte' && (
            <div style={{ position: 'absolute', top: -5, right: -5, background: G, color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Mono',monospace" }}>
              {conteos.length}
            </div>
          )}
        </button>
      </div>

      {/* ═══ SUB REPORTE ═══ */}
      {sub === 'reporte' && (
        <div className="sin" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* stats */}
          <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB' }}>
            {[{ label: 'Productos', value: conteos.length, color: B, bg: BL }, { label: 'Total uds.', value: totalU, color: G, bg: GL }].map(({ label, value, color, bg }) => (
              <div key={label} style={{ flex: 1, padding: 14, background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, borderRight: '1px solid #E5E7EB' }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* selector vista */}
          <div style={{ background: '#fff', padding: '10px 14px', display: 'flex', gap: 10, borderBottom: '1px solid #E5E7EB' }}>
            {[
              { k: 'unitario', lbl: 'Unitario' },
              { k: 'total',    lbl: 'Total' },
            ].map(({ k, lbl }) => {
              const active = rView === k
              return (
                <button
                  key={k}
                  onClick={() => setRView(k)}
                  style={{ flex: 1, padding: '8px 0', border: active ? `2px solid ${B}` : '2px solid #E5E7EB', background: active ? BL : '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: active ? B : '#6B7280' }}
                >
                  {lbl}
                </button>
              )
            })}
          </div>

          {rView === 'unitario' ? (
            <>
              {/* lista de scans individuales (sólo sesión actual) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(80px,1fr) 2fr 52px', padding: '8px 12px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                {['Código', 'Descripción', 'Cant.'].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', textAlign: i === 2 ? 'center' : 'left' }}>{h}</div>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {scans.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                    No hay scans en esta sesión.<br/>
                    <span style={{ fontSize: 11 }}>(el historial unitario es por sesión, no persiste al salir)</span>
                  </div>
                ) : scans.map((s, idx) => (
                  <div key={s.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(80px,1fr) 2fr 52px', padding: '10px 12px', borderBottom: '1px solid #F3F4F6', background: idx === 0 ? GL : (idx % 2 === 1 ? '#FAFAFA' : '#fff'), alignItems: 'center' }}>
                    <div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: B, fontWeight: 500, letterSpacing: '0.04em', background: BL, border: '1px solid #BFDBFE', padding: '2px 4px', display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sku}</div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{fmtH(s.ts)}</div>
                    </div>
                    <div style={{ paddingLeft: 8, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.nombre}</div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.variante}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700, color: s.delta >= 0 ? G : '#DC2626' }}>
                        {s.delta >= 0 ? '+' : ''}{s.delta}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* vista total: una fila por producto, sin edición */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(80px,1fr) 2fr 64px', padding: '8px 12px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                {['Código', 'Descripción', 'Cant.'].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', textAlign: i === 2 ? 'center' : 'left' }}>{h}</div>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {conteos.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No hay productos contados en esta zona.</div>
                ) : conteos.map((c, idx) => (
                  <div key={c.producto_id} style={{ display: 'grid', gridTemplateColumns: 'minmax(80px,1fr) 2fr 64px', padding: '11px 12px', borderBottom: '1px solid #F3F4F6', background: idx % 2 === 0 ? '#fff' : '#FAFAFA', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: B, fontWeight: 500, letterSpacing: '0.04em', background: BL, border: '1px solid #BFDBFE', padding: '2px 4px', display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.sku}</div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{fmtH(c.ts)}</div>
                    </div>
                    <div style={{ paddingLeft: 8, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.variante}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ minWidth: 40, height: 30, background: GL, border: '1px solid #6EE7B7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px' }}>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700, color: G }}>{c.cantidad}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* acciones */}
          <div style={{ padding: '12px 14px', paddingBottom: 'max(env(safe-area-inset-bottom),12px)', borderTop: '1px solid #E5E7EB', background: '#fff', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rView === 'unitario' && (
              <button
                onClick={undoLast}
                disabled={scans.length === 0 || undoing}
                style={{ width: '100%', padding: '12px 0', background: scans.length === 0 || undoing ? '#F3F4F6' : '#FEF3C7', border: `2px solid ${scans.length === 0 || undoing ? '#E5E7EB' : '#F59E0B'}`, fontWeight: 700, fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase', color: scans.length === 0 || undoing ? '#9CA3AF' : '#92400E', cursor: scans.length === 0 || undoing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {undoing
                  ? <><Spinner /> Revirtiendo...</>
                  : <>
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                      {scans.length === 0 ? 'Sin scans para deshacer' : `Deshacer último (${scans[0].nombre})`}
                    </>
                }
              </button>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSub('conteo')} style={{ flex: 1, padding: '14px 0', background: '#F3F4F6', border: 'none', fontWeight: 700, fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><path d="M19 12H5M12 5l-7 7 7 7"/></svg> Volver
              </button>
              <button
                onClick={handleFinalizarZona}
                disabled={saving}
                style={{ flex: 1, padding: '14px 0', background: saving ? `${G}99` : G, color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {saving ? <><Spinner /> Guardando...</> : '✓ Finalizar zona'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SUB CONTEO ═══ */}
      {sub === 'conteo' && (
        <>
          {/* selector modo */}
          <div style={{ background: '#fff', padding: '12px 14px', display: 'flex', gap: 10, borderBottom: '1px solid #E5E7EB' }}>
            {['unitario', 'total'].map(m => {
              const active = modo === m
              return (
                <button
                  key={m}
                  onClick={() => { setModo(m); setProd(null); setQuery(''); setCantidad(1); setNoEnc(false) }}
                  style={{ flex: 1, padding: '10px 0', border: active ? `2px solid ${B}` : '2px solid #E5E7EB', background: active ? BL : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600, fontSize: 14, color: active ? B : '#6B7280' }}
                >
                  <div style={{ width: 20, height: 20, border: active ? `2px solid ${B}` : '2px solid #9CA3AF', background: active ? B : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {active && <svg width={11} height={9} viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter"/></svg>}
                  </div>
                  {m === 'unitario' ? 'Unitario' : 'Total'}
                </button>
              )
            })}
          </div>

          {/* body */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 14, gap: 14, overflowY: 'auto' }}>
            {/* scanner bar */}
            <div style={{ display: 'flex' }}>
              <input
                ref={inpRef} type="search"
                inputMode="text"
                placeholder="Listo para escanear..."
                name="kontar-scan-x7k2" value={query}
                onChange={e => { setQuery(e.target.value); setNoEnc(false) }}
                onKeyDown={e => { if (e.key === 'Enter') procCod(e.currentTarget.value) }}
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                className={noEnc ? 'shake' : ''}
                style={{ flex: 1, height: 46, border: noEnc ? '2px solid #EF4444' : '2px solid #D1D5DB', borderRight: 'none', padding: '0 14px', fontSize: 16, color: '#111827', background: '#fff' }}
                onFocus={e => { if (!noEnc) e.target.style.borderColor = B }}
                onBlur={e => { if (!noEnc) e.target.style.borderColor = '#D1D5DB' }}
              />
              <button onClick={abrirCam} style={{ width: 46, height: 46, background: B, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, borderRight: `1px solid ${BD}` }}>
                <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="square"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx={12} cy={13} r={4}/></svg>
              </button>
              <button onClick={() => setMOpen(true)} style={{ width: 46, height: 46, background: G, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                {buscando
                  ? <div className="spin" style={{ width: 17, height: 17, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%' }} />
                  : <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"><circle cx={11} cy={11} r={7}/><path d="M21 21l-4.35-4.35"/></svg>
                }
              </button>
            </div>

            {noEnc && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '12px 14px', fontSize: 13, color: '#DC2626', fontWeight: 500 }}>
                ✕ Producto no encontrado — usá la lupa para buscarlo o crearlo
              </div>
            )}

            {/* card producto (modo total) */}
            {modo === 'total' && prod && (
              <div className="sup" style={{ background: '#fff', border: '1px solid #E5E7EB', padding: '22px 16px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 21, color: '#111827', lineHeight: 1.2 }}>{prod.nombre}</div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#374151', marginTop: 4 }}>{prod.variante}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6, fontFamily: "'DM Mono',monospace", letterSpacing: '0.04em' }}>SKU: {prod.sku}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button onClick={() => setCantidad(c => Math.max(1, c - 1))} style={{ width: 52, height: 52, background: G, color: '#fff', border: 'none', fontSize: 28, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <input
                    type="number" inputMode="numeric" value={cantidad} autoComplete="off"
                    onChange={e => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: 80, height: 52, border: '2px solid #E5E7EB', borderLeft: 'none', borderRight: 'none', textAlign: 'center', fontWeight: 700, fontSize: 28, color: '#111827', outline: 'none' }}
                  />
                  <button onClick={() => setCantidad(c => c + 1)} style={{ width: 52, height: 52, background: G, color: '#fff', border: 'none', fontSize: 28, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
                <button
                  onClick={handleConf} disabled={confirming}
                  style={{ width: '100%', padding: '16px 0', background: confirming ? '#6EE7B7' : G, color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, letterSpacing: '0.07em', textTransform: 'uppercase', cursor: confirming ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {confirming
                    ? <><Spinner /> Guardando...</>
                    : <><svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"><path d="M20 6L9 17l-5-5"/></svg> Confirmar Conteo</>
                  }
                </button>
              </div>
            )}

            {/* empty state */}
            {(modo === 'unitario' || (modo === 'total' && !prod)) && (
              <div style={{ background: '#fff', border: '1px solid #E5E7EB', flex: '1 0 160px', minHeight: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
                <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="square">
                  {modo === 'unitario'
                    ? <><rect x={3} y={3} width={18} height={18}/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></>
                    : <><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 3H8v4h8V3zM8 17v4M16 17v4"/></>
                  }
                </svg>
                <p style={{ fontSize: 14, color: '#9CA3AF', fontWeight: 500, textAlign: 'center' }}>
                  {modo === 'unitario' ? 'Escaneá un código — suma +1 automáticamente' : 'Escaneá o buscá un producto para contar'}
                </p>
              </div>
            )}
          </div>

          {/* últimos 5 contados */}
          <div style={{ background: '#F9FAFB', borderTop: '1px solid #E5E7EB', padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>
              Últimos {Math.min(5, conteos.length)} contados
            </div>
            {conteos.length === 0 ? (
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>Ningún producto contado aún</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {conteos.slice(0, 5).map((c, i) => (
                  <div key={c.producto_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ background: i === 0 ? GL : '#fff', border: `1px solid ${i === 0 ? '#6EE7B7' : '#E5E7EB'}`, minWidth: 32, height: 22, padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: i === 0 ? G : '#374151' }}>{c.cantidad}</span>
                    </div>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: B, background: BL, border: '1px solid #BFDBFE', padding: '1px 5px', fontWeight: 500, flexShrink: 0, letterSpacing: '0.03em' }}>{c.sku}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: i === 0 ? 600 : 400 }}>
                      {c.nombre}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* footer */}
          <div style={{ display: 'flex', borderTop: '1px solid #E5E7EB', background: '#fff', paddingBottom: 'env(safe-area-inset-bottom,0px)' }}>
            <button onClick={() => setSub('reporte')} style={{ flex: 1, padding: '16px 0', background: '#F3F4F6', border: 'none', fontWeight: 700, fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#374151', cursor: 'pointer', borderRight: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
              Ver conteos
            </button>
            <button
              onClick={handleFinalizarZona}
              disabled={saving}
              style={{ flex: 1, padding: '16px 0', background: saving ? `${G}99` : G, border: 'none', fontWeight: 700, fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              {saving ? <><Spinner /> Guardando...</> : '✓ Finalizar zona'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
