import { useState } from 'react'
import { B, BL, G, GD, GL } from '../../constants/theme'
import ProgBar from '../../components/ProgBar'
import Spinner from '../../components/Spinner'


function CheckIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2.5" strokeLinecap="square">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth="2.2" strokeLinecap="square">
      <rect x={3} y={3} width={18} height={18} />
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
    </svg>
  )
}

export default function ZonasScreen({ inv, zonas, onBack, onZonaSelect, onCrearZona }) {
  const [showModal,  setShowModal]  = useState(false)
  const [nom,        setNom]        = useState('')
  const [desc,       setDesc]       = useState('')
  const [saving,     setSaving]     = useState(false)
  const [errorModal, setErrorModal] = useState('')

  const contados = zonas.reduce((s, z) => s + z.productos_contados, 0)

  const handleCrear = async () => {
    if (!nom.trim()) return
    setSaving(true); setErrorModal('')
    try {
      await onCrearZona(nom.trim(), desc.trim())
      setNom(''); setDesc(''); setShowModal(false)
    } catch (e) {
      setErrorModal(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: '#F3F4F6', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '12px 14px', paddingTop: 'max(env(safe-area-inset-top),12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={onBack} style={{ background: B, border: 'none', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 22, flexShrink: 0 }}>‹</button>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', lineHeight: 1.2 }}>{inv.nombre}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{inv.sucursal}</div>
            </div>
          </div>
          <div style={{ background: GL, border: '1px solid #6EE7B7', padding: '4px 10px', fontSize: 10, fontWeight: 700, color: GD, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {inv.estado}
          </div>
        </div>
        <ProgBar value={contados} total={inv.total_productos} color={B} />
      </div>

      {/* list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {zonas.map(z => {
          const pct = z.total_productos ? Math.min(100, Math.round(z.productos_contados / z.total_productos * 100)) : 0
          return (
            <div key={z.id} style={{ background: '#fff', border: `1.5px solid ${z.finalizada ? '#D1FAE5' : '#E5E7EB'}` }}>
              <div style={{ padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, background: z.finalizada ? GL : BL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {z.finalizada ? <CheckIcon /> : <GridIcon />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{z.nombre}</div>
                  {z.descripcion && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{z.descripcion}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <div style={{ background: z.finalizada ? GL : '#F3F4F6', border: `1px solid ${z.finalizada ? '#6EE7B7' : '#E5E7EB'}`, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: z.finalizada ? G : '#374151' }}>
                        {z.total_productos ? `${z.productos_contados}/${z.total_productos}` : z.productos_contados}
                      </span>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}> productos</span>
                    </div>
                    {z.finalizada && (
                      <span style={{ background: GL, border: '1px solid #6EE7B7', padding: '2px 8px', fontSize: 10, fontWeight: 700, color: GD, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Finalizada</span>
                    )}
                  </div>
                </div>
              </div>

              {z.total_productos > 0 && (
                <div style={{ height: 3, background: '#F3F4F6' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: z.finalizada ? G : B, transition: 'width .4s' }} />
                </div>
              )}

              <div style={{ display: 'flex', borderTop: '1px solid #F3F4F6' }}>
                {z.finalizada ? (
                  <button onClick={() => onZonaSelect(z)} style={{ flex: 1, padding: '13px 14px', background: '#F9FAFB', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#374151' }}>
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.2" strokeLinecap="square"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                    Volver a contar
                  </button>
                ) : (
                  <button onClick={() => onZonaSelect(z)} style={{ flex: 1, padding: '13px 14px', background: BL, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: B }}>
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth="2.5" strokeLinecap="square"><path d="M9 18l6-6-6-6"/></svg>
                    {z.productos_contados > 0 ? 'Continuar conteo' : 'Iniciar conteo'}
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* agregar zona */}
        <button onClick={() => setShowModal(true)} style={{ background: '#fff', border: `2px dashed ${B}55`, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', color: B, fontWeight: 600, fontSize: 14 }}>
          <div style={{ width: 28, height: 28, background: BL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth="2.5" strokeLinecap="square"><line x1={12} y1={5} x2={12} y2={19}/><line x1={5} y1={12} x2={19} y2={12}/></svg>
          </div>
          Agregar zona nueva
        </button>
      </div>


      {/* modal crear zona */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div className="sup" style={{ background: '#fff', width: '100%', maxWidth: 480, borderTop: `3px solid ${B}` }}>
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Nueva zona</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#6B7280', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Nombre *', val: nom, set: setNom, ph: 'Ej: Pasillo A, Depósito 1...' },
                { label: 'Descripción (opcional)', val: desc, set: setDesc, ph: 'Ej: Bebidas y lácteos' },
              ].map(({ label, val, set, ph }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>{label}</div>
                  <input
                    type="text" placeholder={ph} value={val}
                    onChange={e => set(e.target.value)} autoComplete="off"
                    style={{ width: '100%', height: 46, border: '2px solid #E5E7EB', padding: '0 14px', fontSize: 15, color: '#111827', background: '#F9FAFB' }}
                    onFocus={e => e.target.style.borderColor = B}
                    onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                  />
                </div>
              ))}
              {errorModal && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '8px 12px', fontSize: 13, color: '#DC2626' }}>
                  ✕ {errorModal}
                </div>
              )}
            </div>
            <div style={{ padding: '0 16px 16px', paddingBottom: 'max(env(safe-area-inset-bottom),16px)', display: 'flex', gap: 10 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '14px 0', background: '#F3F4F6', border: 'none', fontWeight: 600, fontSize: 14, color: '#374151', cursor: 'pointer' }}>Cancelar</button>
              <button
                onClick={handleCrear}
                disabled={saving || !nom.trim()}
                style={{ flex: 2, padding: '14px 0', background: !nom.trim() || saving ? `${G}99` : G, color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: !nom.trim() || saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {saving ? <><Spinner /> Creando...</> : '✓ Crear zona'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
