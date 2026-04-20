import { useState } from 'react'
import { B, BL, G, GL } from '../../constants/theme'
import ProgBar from '../../components/ProgBar'
import Spinner from '../../components/Spinner'

function InfoRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 14px', borderBottom: '1px solid #F3F4F6' }}>
      <div style={{ width: 32, height: 32, background: BL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', lineHeight: 1.4 }}>{value}</div>
      </div>
    </div>
  )
}

function SelectRow({ icon, label, value, onChange, options, placeholder, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 14px', borderBottom: '1px solid #F3F4F6' }}>
      <div style={{ width: 32, height: 32, background: BL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 4 }}>{label}</div>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          style={{
            width: '100%', height: 36, border: `2px solid ${value ? B : '#E5E7EB'}`,
            padding: '0 10px', fontSize: 13, fontWeight: 600,
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

export default function InventarioScreen({ inv, zonas, sucursales = [], depositos = [], onEntrar, onCrearZona, user, deviceId, onLogout }) {
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [sucursal,    setSucursal]    = useState('')
  const [deposito,    setDeposito]    = useState('')
  const [zonaId,      setZonaId]      = useState('')

  // modal nueva zona
  const [modalZona,  setModalZona]  = useState(false)
  const [nomZona,    setNomZona]    = useState('')
  const [savingZona, setSavingZona] = useState(false)
  const [errZona,    setErrZona]    = useState('')

  const handleSucursalChange = (val) => {
    setSucursal(val)
    setDeposito('')
    setZonaId('')
  }

  const handleDepositoChange = (val) => {
    setDeposito(val)
    setZonaId('')
  }

  const contados    = zonas.reduce((s, z) => s + z.productos_contados, 0)
  const finalizadas = zonas.filter(z => z.finalizada).length

  // Objeto de la sucursal y depósito seleccionados
  const sucursalObj = sucursales.find(s => s.nombre === sucursal)
  const depositoObj = depositos.find(d => d.nombre === deposito)

  // Depósitos filtrados por sucursal
  const depositosFiltrados = sucursalObj
    ? depositos.filter(d => d.sucursal_id === sucursalObj.id)
    : []

  // Zonas filtradas por depósito seleccionado
  const zonasFiltradas = depositoObj
    ? zonas.filter(z => z.deposito_id === depositoObj.id)
    : []

  const sucursalesOpts = sucursales.map(s => ({ value: s.nombre, label: s.nombre }))
  const depositosOpts  = depositosFiltrados.map(d => ({ value: d.nombre, label: d.nombre }))
  const zonasOpts      = zonasFiltradas.map(z => ({
    value: String(z.id),
    label: z.finalizada ? `${z.nombre} ✓` : z.nombre,
  }))

  const puedeIniciar = sucursal !== '' && deposito !== '' && zonaId !== ''

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

      {/* hero */}
      <div style={{ background: B, padding: '16px 16px 28px', paddingTop: 'max(env(safe-area-inset-top),20px)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ background: 'rgba(255,255,255,.18)', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="square">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1={12} y1="22.08" x2={12} y2={12} />
            </svg>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: 'rgba(255,255,255,.22)', border: '1px solid rgba(255,255,255,.4)', padding: '4px 12px', fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {inv.estado}
            </div>
            <button onClick={() => setMenuOpen(true)} style={{ background: 'rgba(255,255,255,.18)', border: 'none', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="square">
                <circle cx={12} cy={5}  r={1.2} fill="#fff" stroke="none"/>
                <circle cx={12} cy={12} r={1.2} fill="#fff" stroke="none"/>
                <circle cx={12} cy={19} r={1.2} fill="#fff" stroke="none"/>
              </svg>
            </button>
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.25, marginBottom: 8 }}>{inv.nombre}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.82)', lineHeight: 1.6 }}>{inv.descripcion}</div>
      </div>

      {/* info + selección */}
      <div style={{ margin: '0 14px', background: '#fff', border: '1px solid #E5E7EB', borderTop: `3px solid ${B}` }}>

        <SelectRow icon={iconSuc} label="Sucursal" value={sucursal} onChange={handleSucursalChange}
          options={sucursalesOpts} placeholder="Seleccioná sucursal..." />

        <SelectRow icon={iconDep} label="Depósito" value={deposito} onChange={handleDepositoChange}
          options={depositosOpts} placeholder={sucursal ? 'Seleccioná depósito...' : 'Primero elegí sucursal'}
          disabled={!sucursal} />

        <InfoRow icon={iconCal}  label="Período"     value={`${inv.fecha_inicio} → ${inv.fecha_limite}`} />
        <InfoRow icon={iconResp} label="Responsable" value={inv.responsable} />

        {/* Zona — select + botón nueva zona */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 14px' }}>
          <div style={{ width: 32, height: 32, background: BL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
            {iconZona}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 4 }}>Zona</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={zonaId}
                onChange={e => setZonaId(e.target.value)}
                disabled={!deposito}
                style={{
                  flex: 1, height: 36, border: `2px solid ${zonaId ? B : '#E5E7EB'}`,
                  padding: '0 10px', fontSize: 13, fontWeight: 600,
                  color: zonaId ? '#111827' : '#9CA3AF',
                  background: !deposito ? '#F3F4F6' : zonaId ? BL : '#F9FAFB',
                  appearance: 'none', cursor: !deposito ? 'not-allowed' : 'pointer',
                }}
              >
                <option value="">{deposito ? (zonasOpts.length === 0 ? 'Sin zonas — creá una' : 'Seleccioná zona...') : 'Primero elegí depósito'}</option>
                {zonasOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button
                onClick={() => { setNomZona(''); setErrZona(''); setModalZona(true) }}
                disabled={!deposito}
                title="Nueva zona"
                style={{
                  width: 36, height: 36, flexShrink: 0,
                  background: deposito ? B : '#E5E7EB',
                  border: 'none', cursor: deposito ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square">
                  <line x1={12} y1={5} x2={12} y2={19}/><line x1={5} y1={12} x2={19} y2={12}/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* progress */}
      <div style={{ margin: '12px 14px 0', background: '#fff', border: '1px solid #E5E7EB', padding: 14 }}>
        <ProgBar value={contados} total={inv.total_productos} color={B} height={8} />
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Zonas finalizadas</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: finalizadas === zonas.length && zonas.length > 0 ? G : B, fontFamily: "'DM Mono',monospace" }}>
              {finalizadas}/{zonas.length}
            </span>
          </div>
          <div style={{ background: '#E5E7EB', height: 6 }}>
            <div style={{ height: '100%', width: `${zonas.length ? Math.round(finalizadas / zonas.length * 100) : 0}%`, background: finalizadas === zonas.length && zonas.length > 0 ? G : B, transition: 'width .4s' }} />
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* footer */}
      <div style={{ padding: '14px', paddingBottom: 'max(env(safe-area-inset-bottom),14px)', borderTop: '1px solid #E5E7EB', background: '#fff' }}>
        {!puedeIniciar && (
          <div style={{ marginBottom: 10, padding: '8px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', fontSize: 12, color: '#92400E', textAlign: 'center' }}>
            {(() => {
              const f = []
              if (!sucursal) f.push('sucursal')
              if (!deposito) f.push('depósito')
              if (!zonaId)   f.push('zona')
              return `Seleccioná: ${f.join(' · ')}`
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
