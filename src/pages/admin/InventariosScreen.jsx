import { useState, useEffect, useCallback } from 'react'
import { B, BL, G, GL } from '../../constants/theme'
import {
  getInventarios, crearInventario, cerrarInventario,
  getInventarioConteos, getInventarioDetalle, getZonaDetalle,
} from '../../services/adminService'
import { fmtFecha } from '../../services/conteoService'
import Spinner from '../../components/Spinner'

const ESTADO_STYLE = {
  abierto: { bg: GL,        color: '#065F46', border: '#6EE7B7', label: 'Abierto' },
  cerrado: { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB', label: 'Cerrado' },
}

function fmtHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function InventariosScreen() {
  const [inventarios, setInventarios] = useState([])
  const [conteos,     setConteos]     = useState({})
  const [loading,     setLoading]     = useState(true)
  const [showModal,   setShowModal]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [errorMsg,    setErrorMsg]    = useState('')
  const [form, setForm] = useState({ nombre: '', sucursal: '', deposito: '', responsable: '', fecha_inicio: '', fecha_limite: '' })

  // ── detalle inventario ────────────────────────────────────────
  const [detalle,        setDetalle]        = useState(null)
  const [detalleData,    setDetalleData]    = useState(null)
  const [detalleLoading, setDetalleLoading] = useState(false)

  // ── detalle zona ──────────────────────────────────────────────
  const [zonaAbierta,    setZonaAbierta]    = useState(null)   // id de zona expandida
  const [zonaConteos,    setZonaConteos]    = useState({})     // { zona_id: [...conteos] }
  const [zonaLoading,    setZonaLoading]    = useState(null)   // zona_id cargando

  const loadData = useCallback(async () => {
    setLoading(true)
    const data = await getInventarios()
    setInventarios(data)
    const counts = {}
    await Promise.all(data.map(async inv => {
      counts[inv.id] = await getInventarioConteos(inv.id)
    }))
    setConteos(counts)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const abrirDetalle = async (inv) => {
    setDetalle(inv)
    setDetalleData(null)
    setDetalleLoading(true)
    setZonaAbierta(null)
    setZonaConteos({})
    try {
      const d = await getInventarioDetalle(inv.id)
      setDetalleData(d)
    } finally {
      setDetalleLoading(false)
    }
  }

  const toggleZona = async (zona_id) => {
    if (zonaAbierta === zona_id) { setZonaAbierta(null); return }
    setZonaAbierta(zona_id)
    if (zonaConteos[zona_id]) return   // already loaded
    setZonaLoading(zona_id)
    try {
      const rows = await getZonaDetalle(zona_id)
      setZonaConteos(prev => ({ ...prev, [zona_id]: rows }))
    } finally {
      setZonaLoading(null)
    }
  }

  const handleCrear = async e => {
    e.preventDefault()
    if (!form.nombre || !form.sucursal) { setErrorMsg('Nombre y sucursal son obligatorios.'); return }
    setSaving(true); setErrorMsg('')
    try {
      await crearInventario(form)
      setShowModal(false)
      setForm({ nombre: '', sucursal: '', deposito: '', responsable: '', fecha_inicio: '', fecha_limite: '' })
      await loadData()
    } catch (e) {
      setErrorMsg(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCerrar = async (id) => {
    if (!confirm('¿Cerrar este inventario? Esta acción no se puede deshacer.')) return
    try {
      await cerrarInventario(id)
      if (detalle?.id === id) setDetalle(d => ({ ...d, estado: 'cerrado' }))
      await loadData()
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Inventarios</div>
          {!loading && <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{inventarios.filter(i => i.estado === 'abierto').length} abiertos · {inventarios.length} total</div>}
        </div>
        <button
          onClick={() => { setShowModal(true); setErrorMsg('') }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: B, border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}
        >
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"><line x1={12} y1={5} x2={12} y2={19}/><line x1={5} y1={12} x2={19} y2={12}/></svg>
          Abrir inventario
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {inventarios.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 14, background: '#fff', border: '1px solid #E5E7EB' }}>
              No hay inventarios. Creá el primero.
            </div>
          )}
          {inventarios.map(inv => {
            const es  = ESTADO_STYLE[inv.estado] || ESTADO_STYLE.cerrado
            const cnt = conteos[inv.id] || 0
            const selected = detalle?.id === inv.id
            return (
              <div
                key={inv.id}
                onClick={() => abrirDetalle(inv)}
                style={{
                  background: '#fff',
                  border: `1px solid ${selected ? B : '#E5E7EB'}`,
                  borderLeft: `4px solid ${inv.estado === 'abierto' ? G : '#D1D5DB'}`,
                  cursor: 'pointer',
                  transition: 'border-color .15s',
                }}
              >
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>{inv.nombre}</div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>{inv.sucursal}{inv.deposito ? ` · ${inv.deposito}` : ''}</div>
                    </div>
                    <span style={{ background: es.bg, color: es.color, border: `1px solid ${es.border}`, padding: '4px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>
                      {es.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    {inv.fecha_inicio && (
                      <span style={{ fontSize: 12, color: '#9CA3AF' }}>{fmtFecha(inv.fecha_inicio)} → {fmtFecha(inv.fecha_limite)}</span>
                    )}
                    {inv.responsable && (
                      <span style={{ fontSize: 12, color: '#9CA3AF' }}>Resp: {inv.responsable}</span>
                    )}
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: G, fontWeight: 700 }}>{cnt} conteos</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: B, fontWeight: 600 }}>Ver detalle →</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── panel de detalle ── */}
      {detalle && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}
        >
          <div
            className="sup"
            style={{ background: '#fff', width: '100%', maxWidth: 520, height: '100%', display: 'flex', flexDirection: 'column', borderLeft: `4px solid ${detalle.estado === 'abierto' ? G : '#D1D5DB'}` }}
          >
            {/* panel header */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>{detalle.nombre}</div>
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                  {detalle.sucursal}{detalle.deposito ? ` · ${detalle.deposito}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                {(() => {
                  const es = ESTADO_STYLE[detalle.estado] || ESTADO_STYLE.cerrado
                  return (
                    <span style={{ background: es.bg, color: es.color, border: `1px solid ${es.border}`, padding: '4px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {es.label}
                    </span>
                  )
                })()}
                <button onClick={() => setDetalle(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#6B7280', lineHeight: 1 }}>✕</button>
              </div>
            </div>

            {/* panel body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {detalleLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
              ) : detalleData ? (
                <>
                  {/* meta info */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                    {[
                      { label: 'Fecha inicio',  value: fmtFecha(detalle.fecha_inicio) || '—' },
                      { label: 'Fecha límite',  value: fmtFecha(detalle.fecha_limite) || '—' },
                      { label: 'Responsable',   value: detalle.responsable || '—' },
                      { label: 'Total conteos', value: detalleData.totalConteos },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', padding: '10px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontFamily: typeof value === 'number' ? "'DM Mono',monospace" : 'inherit', fontSize: typeof value === 'number' ? 20 : 14, fontWeight: 700, color: typeof value === 'number' ? G : '#111827' }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* zonas */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 10 }}>
                      Zonas ({detalleData.zonas.length})
                    </div>
                    {detalleData.zonas.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF', fontSize: 13, background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                        Sin zonas creadas aún.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {detalleData.zonas.map(z => {
                          const open = zonaAbierta === z.id
                          const rows = zonaConteos[z.id] || []
                          const loadingZ = zonaLoading === z.id
                          return (
                            <div key={z.id} style={{ background: '#fff', border: `1px solid ${open ? B : z.finalizada ? '#D1FAE5' : '#E5E7EB'}` }}>
                              {/* zona header — clickable */}
                              <div
                                onClick={() => toggleZona(z.id)}
                                style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}
                              >
                                <div style={{ width: 36, height: 36, background: z.finalizada ? GL : BL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {z.finalizada
                                    ? <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2.5" strokeLinecap="square"><path d="M20 6L9 17l-5-5"/></svg>
                                    : <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth="2.2" strokeLinecap="square"><rect x={3} y={3} width={18} height={18}/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>
                                  }
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
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="square" style={{ flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}><path d="M9 18l6-6-6-6"/></svg>
                              </div>

                              {/* zona detalle expandible */}
                              {open && (
                                <div style={{ borderTop: '1px solid #F3F4F6' }}>
                                  {loadingZ ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><Spinner /></div>
                                  ) : rows.length === 0 ? (
                                    <div style={{ padding: '16px 14px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                                      Sin productos contados en esta zona.
                                    </div>
                                  ) : (
                                    <>
                                      {/* tabla header */}
                                      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 56px', padding: '7px 14px', background: '#F9FAFB', borderBottom: '1px solid #F3F4F6' }}>
                                        {['SKU', 'Producto', 'Cant.'].map((h, i) => (
                                          <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9CA3AF', textAlign: i === 2 ? 'right' : 'left' }}>{h}</div>
                                        ))}
                                      </div>
                                      {/* tabla rows */}
                                      {rows.map((c, i) => (
                                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 56px', padding: '9px 14px', borderBottom: i < rows.length - 1 ? '1px solid #F9FAFB' : 'none', alignItems: 'center', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: B, fontWeight: 600, background: BL, border: '1px solid #BFDBFE', padding: '2px 5px', display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {c.producto?.sku || '—'}
                                          </div>
                                          <div style={{ paddingLeft: 8, minWidth: 0 }}>
                                            <div style={{ fontWeight: 500, fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.producto?.nombre}</div>
                                            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{c.usuario?.nombre} · {fmtHora(c.updated_at)}</div>
                                          </div>
                                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700, color: G, textAlign: 'right' }}>{c.cantidad}</div>
                                        </div>
                                      ))}
                                      {/* total */}
                                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid #E5E7EB', background: GL }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#065F46' }}>Total unidades</span>
                                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: G }}>{rows.reduce((s, c) => s + c.cantidad, 0)}</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* actividad reciente */}
                  {detalleData.actividad.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 10 }}>
                        Actividad reciente
                      </div>
                      <div style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
                        {detalleData.actividad.map((a, i) => (
                          <div key={i} style={{ padding: '11px 14px', borderBottom: i < detalleData.actividad.length - 1 ? '1px solid #F3F4F6' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {a.producto?.nombre || '—'} <span style={{ fontWeight: 400, color: '#6B7280' }}>{a.producto?.variante}</span>
                              </div>
                              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                                {a.zona?.nombre || '—'} · {a.usuario?.nombre || '—'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: G }}>{a.cantidad} uds.</div>
                              <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{fmtHora(a.updated_at)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* panel footer */}
            {detalle.estado === 'abierto' && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid #E5E7EB', flexShrink: 0 }}>
                <button
                  onClick={() => handleCerrar(detalle.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><rect x={3} y={11} width={18} height={11}/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  Cerrar inventario
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* modal crear */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="sup" style={{ background: '#fff', width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', borderTop: `3px solid ${B}` }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Abrir nuevo inventario</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#6B7280' }}>✕</button>
            </div>
            <form onSubmit={handleCrear} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Nombre del inventario *', key: 'nombre',      ph: 'Ej: Inventario Agosto 2025' },
                { label: 'Sucursal *',              key: 'sucursal',    ph: 'Ej: Sucursal Centro' },
                { label: 'Depósito',                key: 'deposito',    ph: 'Ej: Depósito Central – Av. Corrientes' },
                { label: 'Responsable',             key: 'responsable', ph: 'Ej: Lic. Marcos Díaz' },
                { label: 'Fecha inicio',            key: 'fecha_inicio', type: 'date', ph: '' },
                { label: 'Fecha límite',            key: 'fecha_limite', type: 'date', ph: '' },
              ].map(({ label, key, ph, type }) => (
                <div key={key}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>{label}</div>
                  <input
                    type={type || 'text'} placeholder={ph} value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', height: 44, border: '2px solid #E5E7EB', padding: '0 14px', fontSize: 14, color: '#111827', background: '#F9FAFB' }}
                    onFocus={e => e.target.style.borderColor = B}
                    onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                  />
                </div>
              ))}
              {errorMsg && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', fontSize: 13, color: '#DC2626' }}>✕ {errorMsg}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '13px 0', background: '#F3F4F6', border: 'none', fontWeight: 600, fontSize: 14, color: '#374151', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{ flex: 2, padding: '13px 0', background: saving ? `${B}99` : B, color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {saving ? <><Spinner /> Creando...</> : '✓ Abrir inventario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
