import { useState, useEffect, useRef } from 'react'
import { B, BL, G, GL } from '../../../constants/theme'
import { bxTxt, crearProducto } from '../../../services/productService'
import Spinner from '../../../components/Spinner'

export default function ModalBusqueda({ onSeleccionar, onCerrar, codigoInicial = '' }) {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [crearView, setCrearView] = useState(!!codigoInicial)
  const [nNom,  setNNom]  = useState('')
  const [nVar,  setNVar]  = useState('')
  const [nSku,  setNSku]  = useState(codigoInicial)
  const [nCant, setNCant] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)
  const debRef   = useRef(null)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80) }, [])

  useEffect(() => {
    clearTimeout(debRef.current)
    if (!query.trim()) { setResults([]); return }
    setLoading(true)
    debRef.current = setTimeout(async () => {
      const r = await bxTxt(query)
      setResults(r)
      setLoading(false)
    }, 280)
  }, [query])

  const handleCrearProd = async () => {
    if (!nNom.trim() || !nSku.trim() || !nCant) return
    setSaving(true)
    try {
      const cod = nSku.trim()
      const p = await crearProducto({
        sku:           cod,
        nombre:        nNom.trim(),
        variante:      nVar.trim(),
        codigo_barras: cod,
      })
      onSeleccionar(p, parseInt(nCant) || 1, true)
    } catch (err) {
      alert(err.message)
      setSaving(false)
    }
  }

  const campos = [
    { lbl: 'Nombre del producto *', val: nNom, set: setNNom, ph: 'Ej: Coca Cola',    mono: false },
    { lbl: 'Variante / presentación',val: nVar, set: setNVar, ph: 'Ej: 500ml, 1kg...', mono: false },
    { lbl: 'Código de barras *',     val: nSku, set: setNSku, ph: '784000123456',     mono: true  },
    { lbl: 'Cantidad *',             val: nCant,set: setNCant,ph: '0',                mono: false, type: 'number' },
  ]

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div className="sup" style={{ background: '#fff', width: '100%', maxWidth: 480, maxHeight: '88vh', display: 'flex', flexDirection: 'column', borderTop: `3px solid ${B}` }}>

        {/* header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#111827' }}>{crearView ? 'Crear producto' : 'Buscar producto'}</div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#6B7280', lineHeight: 1 }}>✕</button>
        </div>

        {!crearView ? (
          <>
            {/* search input */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }}>
                  <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><circle cx={11} cy={11} r={7}/><path d="M21 21l-4.35-4.35"/></svg>
                </span>
                <input
                  ref={inputRef} type="text" placeholder="Nombre, variante o código..."
                  value={query} onChange={e => setQuery(e.target.value)}
                  autoComplete="off" spellCheck={false}
                  style={{ width: '100%', height: 46, border: '2px solid #E5E7EB', paddingLeft: 40, paddingRight: 14, fontSize: 15, color: '#111827', background: '#F9FAFB' }}
                  onFocus={e => e.target.style.borderColor = B}
                  onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                />
                {loading && <div className="spin" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, border: `2px solid #E5E7EB`, borderTopColor: B, borderRadius: '50%' }} />}
              </div>
            </div>

            {/* results */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {results.length > 0
                ? results.map(p => (
                    <div key={p.id} onClick={() => onSeleccionar(p)} style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, background: '#fff' }}>
                      <div style={{ width: 40, height: 40, background: BL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth={2} strokeLinecap="square"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1={12} y1="22.08" x2={12} y2={12}/></svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{p.nombre}</div>
                        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{p.variante}</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: B, marginTop: 3, letterSpacing: '0.04em' }}>{p.sku}</div>
                      </div>
                      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="square"><path d="M9 18l6-6-6-6"/></svg>
                    </div>
                  ))
                : query.length > 0 && !loading
                  ? <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>Sin resultados para "{query}"</div>
                  : <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                      <svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.2" strokeLinecap="square" style={{ margin: '0 auto 12px', display: 'block' }}><circle cx={11} cy={11} r={7}/><path d="M21 21l-4.35-4.35"/></svg>
                      <div style={{ color: '#9CA3AF', fontSize: 14 }}>Escribí para buscar</div>
                    </div>
              }
            </div>

            {/* footer */}
            <div style={{ padding: '12px 16px', paddingBottom: 'max(env(safe-area-inset-bottom),12px)', borderTop: '1px solid #E5E7EB' }}>
              <button onClick={() => setCrearView(true)} style={{ width: '100%', padding: '14px 0', background: B, color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"><line x1={12} y1={5} x2={12} y2={19}/><line x1={5} y1={12} x2={19} y2={12}/></svg>
                Crear producto nuevo
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {campos.map(({ lbl, val, set, ph, mono, type }) => (
                <div key={lbl}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>{lbl}</div>
                  <input
                    type={type || 'text'} inputMode={type === 'number' ? 'numeric' : 'text'}
                    placeholder={ph} value={val} onChange={e => set(e.target.value)} autoComplete="off"
                    style={{ width: '100%', height: 46, border: '2px solid #E5E7EB', padding: '0 14px', fontSize: 15, color: '#111827', background: '#F9FAFB', fontFamily: mono ? "'DM Mono',monospace" : 'inherit', letterSpacing: mono ? '0.05em' : 'normal' }}
                    onFocus={e => e.target.style.borderColor = B}
                    onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                  />
                </div>
              ))}
              <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', padding: '10px 12px', fontSize: 12, color: '#92400E' }}>
                ⚠ El producto se creará y el conteo quedará registrado en esta zona.
              </div>
            </div>
            <div style={{ padding: '12px 16px', paddingBottom: 'max(env(safe-area-inset-bottom),12px)', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 10 }}>
              <button onClick={() => setCrearView(false)} style={{ flex: 1, padding: '14px 0', background: '#F3F4F6', border: 'none', fontWeight: 600, fontSize: 14, color: '#374151', cursor: 'pointer' }}>← Volver</button>
              <button
                onClick={handleCrearProd}
                disabled={saving || !nNom.trim() || !nSku.trim() || !nCant}
                style={{ flex: 2, padding: '14px 0', background: !nNom.trim() || !nSku.trim() || !nCant || saving ? `${G}99` : G, color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: !nNom.trim() || !nSku.trim() || !nCant || saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {saving ? <><Spinner /> Creando...</> : '✓ Guardar y contar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
