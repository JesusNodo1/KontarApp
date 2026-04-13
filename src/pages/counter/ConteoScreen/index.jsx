import { useState, useRef, useCallback, useEffect } from 'react'
import { B, BD, BL, G, GD, GL } from '../../../constants/theme'
import { bxCod } from '../../../services/productService'
import { loadZx } from '../../../services/scanner'
import { getConteosPorZona, upsertConteo } from '../../../services/conteoService'
import Spinner from '../../../components/Spinner'
import ModalCam from './ModalCam'
import ModalBusqueda from './ModalBusqueda'

const sl = ms => new Promise(r => setTimeout(r, ms))

export default function ConteoScreen({ zona, inv, onBack, onZonaFinalizada, user }) {
  const [sub,        setSub]        = useState('conteo')
  const [modo,       setModo]       = useState('total')
  const [query,      setQuery]      = useState('')
  const [prod,       setProd]       = useState(null)
  const [cantidad,   setCantidad]   = useState(1)
  const [conteos,    setConteos]    = useState([])
  const [loadingC,   setLoadingC]   = useState(true)
  const [buscando,   setBuscando]   = useState(false)
  const [noEnc,      setNoEnc]      = useState(false)
  const [flash,      setFlash]      = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [mOpen,      setMOpen]      = useState(false)
  const [camO,       setCamO]       = useState(false)
  const [camE,       setCamE]       = useState('')
  const [camR,       setCamR]       = useState(false)
  const [eId,        setEId]        = useState(null)
  const [eVal,       setEVal]       = useState('')

  const vidRef = useRef(null)
  const rdrRef = useRef(null)
  const inpRef = useRef(null)

  // Cargar conteos existentes al entrar en la zona
  useEffect(() => {
    setLoadingC(true)
    getConteosPorZona(zona.id)
      .then(data => setConteos(data))
      .catch(() => setConteos([]))
      .finally(() => setLoadingC(false))
  }, [zona.id])

  const tFlash = () => { setFlash(true); setTimeout(() => setFlash(false), 500) }

  // Guardar en DB y actualizar estado local
  const reg = useCallback(async (p, c) => {
    // Optimistic update
    setConteos(prev => {
      const i = prev.findIndex(x => x.producto_id === p.id)
      const item = { id: p.id, producto_id: p.id, nombre: p.nombre, variante: p.variante, sku: p.sku, cantidad: c, ts: new Date() }
      if (i !== -1) {
        const cp = [...prev]
        cp[i] = item
        const [it] = cp.splice(i, 1)
        return [it, ...cp]
      }
      return [item, ...prev]
    })
    // Persist to Supabase
    try {
      await upsertConteo({
        zona_id:      zona.id,
        inventario_id: inv.id,
        producto_id:  p.id,
        usuario_id:   user.id,
        cantidad:     c,
      })
    } catch (e) {
      console.error('[ConteoScreen] upsertConteo error:', e)
    }
  }, [zona.id, inv.id, user.id])

  /* ── cámara ── */
  const abrirCam = useCallback(async () => {
    setCamE(''); setCamO(true); setCamR(false)
    const mod = await loadZx()
    if (!mod) { setCamE('Error al cargar librería de escaneo.'); return }
    const { BrowserMultiFormatReader } = mod
    const r = new BrowserMultiFormatReader()
    rdrRef.current = r
    try {
      const allDevs = await navigator.mediaDevices.enumerateDevices()
      const devs = allDevs.filter(d => d.kind === 'videoinput')
      if (!devs.length) throw new Error('No se encontró cámara.')
      setCamR(true)
      const deviceId = devs[devs.length - 1].deviceId
      r.decodeFromVideoDevice(deviceId || undefined, vidRef.current, res => {
        if (res) { cerrarCam(); procCod(res.getText()) }
      })
    } catch (e) { setCamE(e.message || 'Error de cámara.') }
  }, [])

  const cerrarCam = useCallback(() => {
    rdrRef.current?.reset(); rdrRef.current = null
    setCamO(false); setCamR(false)
  }, [])

  useEffect(() => () => rdrRef.current?.reset(), [])

  /* ── búsqueda por código ── */
  const procCod = useCallback(async cod => {
    if (!cod?.trim()) return
    setBuscando(true); setNoEnc(false)
    const p = await bxCod(cod)
    setBuscando(false)
    if (!p) { setNoEnc(true); setTimeout(() => setNoEnc(false), 1800); return }
    if (modo === 'unitario') { await sl(120); await reg(p, 1); tFlash(); setQuery(''); inpRef.current?.focus() }
    else { setProd(p); setCantidad(1); setQuery(cod) }
  }, [modo, reg])

  const handleConf = async () => {
    if (!prod || cantidad < 1) return
    setConfirming(true)
    await reg(prod, cantidad)
    tFlash()
    setProd(null); setQuery(''); setCantidad(1); setConfirming(false)
    inpRef.current?.focus()
  }

  /* ── edición inline de cantidad en reporte ── */
  const handleEditBlur = async (c, rawVal) => {
    const v = parseInt(rawVal)
    setEId(null)
    if (isNaN(v) || v < 0) return
    const p = { id: c.producto_id, nombre: c.nombre, variante: c.variante, sku: c.sku }
    await reg(p, v)
  }

  /* ── selección desde modal ── */
  const handleSelModal = async (p, cant = 1, esNuevo = false) => {
    if (esNuevo) {
      await reg(p, cant); tFlash()
      setMOpen(false); setProd(null); setQuery(''); setCantidad(1)
      inpRef.current?.focus(); return
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3F4F6' }}>
        <div className="spin" style={{ width: 24, height: 24, border: '3px solid #E5E7EB', borderTopColor: B, borderRadius: '50%' }} />
      </div>
    )
  }

  return (
    <div style={{ background: '#F3F4F6', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {flash && <div className="flash" />}
      {camO  && <ModalCam vidRef={vidRef} camR={camR} camE={camE} onCerrar={cerrarCam} />}
      {mOpen && <ModalBusqueda onSeleccionar={handleSelModal} onCerrar={() => setMOpen(false)} />}

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
        <div className="sin" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB' }}>
            {[{ label: 'Productos', value: conteos.length, color: B, bg: BL }, { label: 'Total uds.', value: totalU, color: G, bg: GL }].map(({ label, value, color, bg }) => (
              <div key={label} style={{ flex: 1, padding: 14, background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, borderRight: '1px solid #E5E7EB' }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* tabla header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(80px,1fr) 2fr 64px 44px', padding: '8px 12px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
            {['Código', 'Descripción', 'Cant.', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', textAlign: i === 2 ? 'center' : i === 3 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>

          {/* tabla rows */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conteos.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No hay productos contados en esta zona.</div>
            )}
            {conteos.map((c, idx) => (
              <div key={c.producto_id} style={{ display: 'grid', gridTemplateColumns: 'minmax(80px,1fr) 2fr 64px 44px', padding: '11px 12px', borderBottom: '1px solid #F3F4F6', background: idx % 2 === 0 ? '#fff' : '#FAFAFA', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: B, fontWeight: 500, letterSpacing: '0.04em', background: BL, border: '1px solid #BFDBFE', padding: '2px 4px', display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.sku}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{fmtH(c.ts)}</div>
                </div>
                <div style={{ paddingLeft: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{c.variante}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {eId === c.producto_id
                    ? <input
                        type="number" inputMode="numeric" value={eVal}
                        onChange={e => setEVal(e.target.value)}
                        onBlur={() => handleEditBlur(c, eVal)}
                        onKeyDown={e => { if (e.key === 'Enter') handleEditBlur(c, eVal) }}
                        autoFocus
                        style={{ width: 50, height: 34, border: `2px solid ${B}`, textAlign: 'center', fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 700, color: B, background: BL, outline: 'none' }}
                      />
                    : <div onClick={() => { setEId(c.producto_id); setEVal(String(c.cantidad)) }} style={{ minWidth: 40, height: 34, background: GL, border: '1px solid #6EE7B7', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '0 8px' }}>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 17, fontWeight: 700, color: G }}>{c.cantidad}</span>
                      </div>
                  }
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setProd({ id: c.producto_id, nombre: c.nombre, variante: c.variante, sku: c.sku }); setCantidad(c.cantidad); setModo('total'); setQuery(c.sku); setSub('conteo') }}
                    style={{ width: 36, height: 36, background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.2" strokeLinecap="square"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: '12px 14px', paddingBottom: 'max(env(safe-area-inset-bottom),12px)', borderTop: '1px solid #E5E7EB', background: '#fff', display: 'flex', gap: 10 }}>
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
                ref={inpRef} type="text" inputMode="text" placeholder="Listo para escanear..."
                value={query}
                onChange={e => { setQuery(e.target.value); setNoEnc(false) }}
                onKeyDown={e => { if (e.key === 'Enter') procCod(query) }}
                autoComplete="off" spellCheck={false}
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
                    type="number" inputMode="numeric" value={cantidad}
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

          {/* último contado */}
          <div style={{ background: '#F9FAFB', borderTop: '1px solid #E5E7EB', padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 10 }}>Último producto contado</div>
            {ultimo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: GL, border: '1px solid #6EE7B7', width: 54, height: 54, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 22, color: G, lineHeight: 1, fontFamily: "'DM Mono',monospace" }}>{ultimo.cantidad}</div>
                  <div style={{ fontSize: 9, color: GD, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>uds.</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ultimo.nombre} {ultimo.variante}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 5, background: BL, border: '1px solid #BFDBFE', padding: '3px 8px' }}>
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth="2.5" strokeLinecap="square"><rect x={3} y={3} width={18} height={18}/><path d="M7 7v10M10 7v10M14 7v5M17 7v5M14 15v2M17 15v2"/></svg>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 500, color: B, letterSpacing: '0.06em' }}>{ultimo.sku}</span>
                  </div>
                </div>
                <div style={{ background: GL, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2.5" strokeLinecap="square"><path d="M20 6L9 17l-5-5"/></svg>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#9CA3AF' }}>Ningún producto contado aún</div>
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
