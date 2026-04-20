import { useState, useEffect } from 'react'
import { B, BL, G, GL } from '../../constants/theme'
import ProgBar from '../../components/ProgBar'
import Spinner from '../../components/Spinner'

const LS_KEY = 'kontar_selection'

function InfoRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderBottom: '1px solid #F3F4F6' }}>
      <div style={{ width: 28, height: 28, background: BL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF' }}>{label}</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{value}</div>
      </div>
    </div>
  )
}

function SelectRow({ icon, label, value, onChange, options, placeholder, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderBottom: '1px solid #F3F4F6' }}>
      <div style={{ width: 28, height: 28, background: BL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 3 }}>{label}</div>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          style={{
            width: '100%', height: 32, border: `2px solid ${value ? B : '#E5E7EB'}`,
            padding: '0 8px', fontSize: 13, fontWeight: 600,
            color: value ? '#111827' : '#9CA3AF',
            background: disabled ? '#F3F4F6' : value ? BL : '#F9FAFB',
            appearance: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          <option value="">{placeholder}</option>
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default function InventarioScreen({
  inv, invLoading, zonas,
  sucursales = [], depositos = [],
  onDepositoSelect, onEntrar, onCrearZona, onFinalizarInventario,
  user, deviceId, onLogout,
}) {
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [sucursal,    setSucursal]    = useState('')
  const [deposito,    setDeposito]    = useState('')
  const [zonaId,      setZonaId]      = useState('')

  // modal nueva zona
  const [modalZona,  setModalZona]  = useState(false)
  const [nomZona,    setNomZona]    = useState('')
  const [savingZona, setSavingZona] = useState(false)
  const [errZona,    setErrZona]    = useState('')

  /* ─── Restaurar selección desde localStorage ───────────────── */
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
      if (saved.sucursal) setSucursal(saved.sucursal)
      if (saved.deposito) setDeposito(saved.deposito)
      if (saved.deposito_id) onDepositoSelect(saved.deposito_id)
      if (saved.zonaId) setZonaId(saved.zonaId)
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Guardar selección en localStorage ────────────────────── */
  useEffect(() => {
    if (!sucursal && !deposito) return
    const dep = depositos.find(d => d.nombre === deposito)
    localStorage.setItem(LS_KEY, JSON.stringify({
      sucursal,
      deposito,
      deposito_id: dep?.id || null,
      zonaId,
    }))
  }, [sucursal, deposito, zonaId, depositos])

  /* ─── Validar zonaId cuando cambian las zonas ──────────────── */
  useEffect(() => {
    if (zonaId && zonas.length > 0) {
      const existe = zonas.some(z => String(z.id) === zonaId)
      if (!existe) setZonaId('')
    }
  }, [zonas]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSucursalChange = val => {
    setSucursal(val)
    setDeposito('')
    setZonaId('')
    onDepositoSelect(null)
  }

  const handleDepositoChange = val => {
    setDeposito(val)
    setZonaId('')
    const dep = depositos.find(d => d.nombre === val)
    onDepositoSelect(dep?.id || null)
  }

  const contados    = zonas.reduce((s, z) => s + z.productos_contados, 0)
  const finalizadas = zonas.filter(z => z.finalizada).length

  // Cascading options
  const sucursalObj       = sucursales.find(s => s.nombre === sucursal)
  const depositoObj       = depositos.find(d => d.nombre === deposito)
  const depositosFiltrados = sucursalObj ? depositos.filter(d => d.sucursal_id === sucursalObj.id) : []
  const zonasFiltradas    = depositoObj  ? zonas.filter(z => z.deposito_id === depositoObj.id)     : []

  const sucursalesOpts = sucursales.map(s => ({ value: s.nombre, label: s.nombre }))
  const depositosOpts  = depositosFiltrados.map(d => ({ value: d.nombre, label: d.nombre }))
  const zonasOpts      = zonasFiltradas.map(z => ({
    value: String(z.id),
    label: z.finalizada ? `${z.nombre} ✓` : z.nombre,
  }))

  const puedeIniciar = !!inv && sucursal !== '' && deposito !== '' && zonaId !== ''

  const handleIniciar = () => {
    if (!puedeIniciar) return
    const zona = zonas.find(z => String(z.id) === zonaId)
    if (zona) onEntrar(zona)
  }

  const handleCrearZona = async e => {
    e.preventDefault()
    const nombre = nomZona.trim()
    if (!nombre) { setErrZona('El nombre es obligatorio.'); return }
    setSavingZona(true); setErrZona('')
    try {
      const nueva = await onCrearZona(nombre, '', depositoObj?.id || null)
      setZonaId(String(nueva.id))
      setModalZona(false)
      setNomZona('')
    } catch (err) {
      setErrZona(err.message)
    } finally {
      setSavingZona(false)
    }
  }

  const iconSuc  = <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth="2.2" strokeLinecap="square"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  const iconDep  = <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth="2.2" strokeLinecap="square"><rect x={1} y={3} width={15} height={13}/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
  const iconCal  = <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth="2.2" strokeLinecap="square"><rect x={3} y={4} width={18} height={18}/><line x1={16} y1={2} x2={16} y2={6}/><line x1={8} y1={2} x2={8} y2={6}/><line x1={3} y1={10} x2={21} y2={10}/></svg>
  const iconResp = <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth="2.2" strokeLinecap="square"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx={12} cy={7} r={4}/></svg>
  const iconZona = <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth="2.2" strokeLinecap="square"><rect x={3} y={3} width={18} height={18}/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>

  return (
    <div style={{ background: '#F3F4F6', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* hero — fila única compacta */}
      <div style={{ background: B, padding: '10px 14px', paddingTop: 'max(env(safe-area-inset-top),10px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'rgba(255,255,255,.18)', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="square">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1={12} y1="22.08" x2={12} y2={12} />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {inv ? inv.nombre : 'Inventario'}
            </div>
            {inv?.descripcion && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.descripcion}</div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {inv && (
              <div style={{ background: 'rgba(255,255,255,.22)', border: '1px solid rgba(255,255,255,.4)', padding: '3px 8px', fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {inv.estado}
              </div>
            )}
            <button onClick={() => setMenuOpen(true)} style={{ background: 'rgba(255,255,255,.18)', border: 'none', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="square">
                <circle cx={12} cy={5}  r={1.2} fill="#fff" stroke="none"/>
                <circle cx={12} cy={12} r={1.2} fill="#fff" stroke="none"/>
                <circle cx={12} cy={19} r={1.2} fill="#fff" stroke="none"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* selección + info */}
      <div style={{ margin: '0 12px', background: '#fff', border: '1px solid #E5E7EB', borderTop: `3px solid ${B}` }}>

        <SelectRow icon={iconSuc} label="Sucursal" value={sucursal} onChange={handleSucursalChange}
          options={sucursalesOpts} placeholder="Seleccioná sucursal..." />

        <SelectRow icon={iconDep} label="Depósito" value={deposito} onChange={handleDepositoChange}
          options={depositosOpts} placeholder={sucursal ? 'Seleccioná depósito...' : 'Primero elegí sucursal'}
          disabled={!sucursal} />

        {/* Estado del inventario según selección de depósito */}
        {deposito && (
          invLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #F3F4F6' }}>
              <Spinner />
              <span style={{ fontSize: 12, color: '#6B7280' }}>Buscando inventario activo...</span>
            </div>
          ) : !inv ? (
            <div style={{ padding: '8px 12px', background: '#FFFBEB', borderBottom: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2.5" strokeLinecap="square" style={{ flexShrink: 0 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1={12} y1={9} x2={12} y2={13}/><line x1={12} y1={17} x2={12.01} y2={17}/>
              </svg>
              <span style={{ fontSize: 12, color: '#92400E', fontWeight: 500 }}>No hay inventario activo para este depósito</span>
            </div>
          ) : (
            <>
              <InfoRow icon={iconCal}  label="Período"     value={`${inv.fecha_inicio} → ${inv.fecha_limite}`} />
              <InfoRow icon={iconResp} label="Responsable" value={inv.responsable} />

              {/* Zona */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px' }}>
                <div style={{ width: 28, height: 28, background: BL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {iconZona}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 3 }}>Zona</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select
                      value={zonaId}
                      onChange={e => setZonaId(e.target.value)}
                      style={{
                        flex: 1, height: 32, border: `2px solid ${zonaId ? B : '#E5E7EB'}`,
                        padding: '0 8px', fontSize: 13, fontWeight: 600,
                        color: zonaId ? '#111827' : '#9CA3AF',
                        background: zonaId ? BL : '#F9FAFB',
                        appearance: 'none', cursor: 'pointer',
                      }}
                    >
                      <option value="">{zonasOpts.length === 0 ? 'Sin zonas — creá una' : 'Seleccioná zona...'}</option>
                      {zonasOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <button
                      onClick={() => { setNomZona(''); setErrZona(''); setModalZona(true) }}
                      title="Nueva zona"
                      style={{
                        width: 32, height: 32, flexShrink: 0,
                        background: B, border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square">
                        <line x1={12} y1={5} x2={12} y2={19}/><line x1={5} y1={12} x2={19} y2={12}/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )
        )}
      </div>

      {/* progress — solo si hay inventario */}
      {inv && !invLoading && (
        <div style={{ margin: '8px 14px 0', background: '#fff', border: '1px solid #E5E7EB', padding: '10px 12px' }}>
          <ProgBar value={contados} total={inv.total_productos} color={B} height={6} />
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Zonas finalizadas</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: finalizadas === zonas.length && zonas.length > 0 ? G : B, fontFamily: "'DM Mono',monospace" }}>
                  {finalizadas}/{zonas.length}
                </span>
              </div>
              <div style={{ background: '#E5E7EB', height: 5 }}>
                <div style={{ height: '100%', width: `${zonas.length ? Math.round(finalizadas / zonas.length * 100) : 0}%`, background: finalizadas === zonas.length && zonas.length > 0 ? G : B, transition: 'width .4s' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* footer */}
      <div style={{ padding: '14px', paddingBottom: 'max(env(safe-area-inset-bottom),14px)', borderTop: '1px solid #E5E7EB', background: '#fff' }}>
        {!puedeIniciar && (
          <div style={{ marginBottom: 10, padding: '8px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', fontSize: 12, color: '#92400E', textAlign: 'center' }}>
            {(() => {
              if (!sucursal) return 'Seleccioná una sucursal'
              if (!deposito) return 'Seleccioná un depósito'
              if (invLoading) return 'Buscando inventario...'
              if (!inv) return 'No hay inventario activo para este depósito'
              if (!zonaId) return 'Seleccioná una zona'
              return ''
            })()}
          </div>
        )}
        <button
          onClick={handleIniciar}
          disabled={!puedeIniciar}
          style={{
            width: '100%', padding: '17px 0',
            background: puedeIniciar ? B : '#D1D5DB',
            color: '#fff', border: 'none', fontWeight: 700, fontSize: 16,
            letterSpacing: '0.04em', textTransform: 'uppercase',
            cursor: puedeIniciar ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square">
            <path d="M9 18l6-6-6-6" />
          </svg>
          Iniciar conteo
        </button>
      </div>

      {/* modal nueva zona */}
      {modalZona && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div className="sup" style={{ background: '#fff', width: '100%', maxWidth: 480, borderTop: `3px solid ${B}`, paddingBottom: 'max(env(safe-area-inset-bottom),16px)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Nueva zona</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Depósito: <strong>{deposito}</strong></div>
              </div>
              <button onClick={() => setModalZona(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#6B7280' }}>✕</button>
            </div>
            <form onSubmit={handleCrearZona} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>Nombre de la zona *</div>
                <input
                  autoFocus
                  autoComplete="off"
                  value={nomZona}
                  onChange={e => setNomZona(e.target.value)}
                  placeholder="Ej: Góndola A, Cámara Fría, Depósito 1..."
                  style={{ width: '100%', height: 44, border: `2px solid ${B}`, padding: '0 14px', fontSize: 14, color: '#111827', background: '#F9FAFB', boxSizing: 'border-box' }}
                />
              </div>
              {errZona && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '8px 12px', fontSize: 13, color: '#DC2626' }}>✕ {errZona}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setModalZona(false)} style={{ flex: 1, padding: '13px 0', background: '#F3F4F6', border: 'none', fontWeight: 600, fontSize: 14, color: '#374151', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={savingZona} style={{ flex: 2, padding: '13px 0', background: savingZona ? `${B}99` : B, color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: savingZona ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {savingZona ? <><Spinner /> Creando...</> : '✓ Crear zona'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* menu drawer */}
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 40 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', zIndex: 50, borderTop: `3px solid ${B}`, paddingBottom: 'max(env(safe-area-inset-bottom),16px)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 36, height: 4, background: '#D1D5DB', borderRadius: 2 }} />
            </div>
            <div style={{ padding: '8px 20px 16px', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 4 }}>Usuario</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{user?.nombre || '—'}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{user?.email || ''}</div>
            </div>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 6 }}>ID de terminal</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#374151', background: '#F9FAFB', border: '1px solid #E5E7EB', padding: '8px 10px', wordBreak: 'break-all', lineHeight: 1.5 }}>
                {deviceId || '—'}
              </div>
            </div>
            <div style={{ padding: '14px 20px 4px' }}>
              <button onClick={onLogout} style={{ width: '100%', padding: '14px 0', background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontWeight: 700, fontSize: 14, letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2.2} strokeLinecap="square">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1={21} y1={12} x2={9} y2={12}/>
                </svg>
                Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
