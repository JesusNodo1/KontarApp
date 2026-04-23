import { useState, useEffect, useCallback } from 'react'
import { B, BL } from '../../constants/theme'
import {
  getSucursales, crearSucursal, editarSucursal, toggleSucursal,
  getDepositos,  crearDeposito,  editarDeposito,  toggleDeposito,
} from '../../services/adminService'
import Spinner from '../../components/Spinner'

const inputStyle = (focused) => ({
  width: '100%', height: 42, border: `2px solid ${focused ? B : '#E5E7EB'}`,
  padding: '0 12px', fontSize: 14, color: '#111827', background: '#F9FAFB', boxSizing: 'border-box',
})

export default function SucursalesScreen() {
  const [sucursales, setSucursales] = useState([])
  const [depositos,  setDepositos]  = useState([])
  const [loading,    setLoading]    = useState(true)

  // modal sucursal
  const [modalSuc,  setModalSuc]  = useState(false)
  const [editSuc,   setEditSuc]   = useState(null)
  const [nomSuc,    setNomSuc]    = useState('')
  const [savingSuc, setSavingSuc] = useState(false)
  const [errSuc,    setErrSuc]    = useState('')

  // modal depósito
  const [modalDep,  setModalDep]  = useState(false)
  const [editDep,   setEditDep]   = useState(null)
  const [nomDep,    setNomDep]    = useState('')
  const [sucDep,    setSucDep]    = useState('')   // sucursal_id del depósito
  const [savingDep, setSavingDep] = useState(false)
  const [errDep,    setErrDep]    = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [s, d] = await Promise.all([getSucursales(false), getDepositos(false)])
    setSucursales(s)
    setDepositos(d)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Sucursales ──────────────────────────────────────────────
  const openCrearSuc  = ()    => { setEditSuc(null); setNomSuc(''); setErrSuc(''); setModalSuc(true) }
  const openEditarSuc = (s)   => { setEditSuc(s); setNomSuc(s.nombre); setErrSuc(''); setModalSuc(true) }

  const handleSucursal = async e => {
    e.preventDefault()
    const val = nomSuc.trim()
    if (!val) { setErrSuc('El nombre es obligatorio.'); return }
    setSavingSuc(true); setErrSuc('')
    try {
      if (editSuc) await editarSucursal(editSuc.id, val)
      else         await crearSucursal(val)
      setModalSuc(false)
      await loadData()
    } catch (err) { setErrSuc(err.message) }
    finally { setSavingSuc(false) }
  }

  // ── Depósitos ───────────────────────────────────────────────
  const openCrearDep  = (sucId = '') => { setEditDep(null); setNomDep(''); setSucDep(String(sucId)); setErrDep(''); setModalDep(true) }
  const openEditarDep = (d)          => { setEditDep(d); setNomDep(d.nombre); setSucDep(d.sucursal_id ? String(d.sucursal_id) : ''); setErrDep(''); setModalDep(true) }

  const handleDeposito = async e => {
    e.preventDefault()
    const val = nomDep.trim()
    if (!val)  { setErrDep('El nombre es obligatorio.'); return }
    if (!sucDep) { setErrDep('Seleccioná una sucursal.'); return }
    setSavingDep(true); setErrDep('')
    try {
      if (editDep) await editarDeposito(editDep.id, val)  // nombre solo por ahora
      else         await crearDeposito(val, Number(sucDep))
      setModalDep(false)
      await loadData()
    } catch (err) { setErrDep(err.message) }
    finally { setSavingDep(false) }
  }

  const sucIcon = <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth="2.2" strokeLinecap="square"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  const depIcon = <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth="2.2" strokeLinecap="square"><rect x={1} y={3} width={15} height={13}/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>

  return (
    <div style={{ padding: '24px 20px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Sucursales y Depósitos</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Los depósitos están asociados a una sucursal.</div>
        </div>
        <button
          onClick={openCrearSuc}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: B, border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"><line x1={12} y1={5} x2={12} y2={19}/><line x1={5} y1={12} x2={19} y2={12}/></svg>
          Nueva sucursal
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
      ) : sucursales.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 14, background: '#fff', border: '1px solid #E5E7EB' }}>
          No hay sucursales. Creá la primera con el botón de arriba.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sucursales.map(suc => {
            const deps = depositos.filter(d => d.sucursal_id === suc.id)
            return (
              <div key={suc.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderLeft: `4px solid ${suc.activo ? B : '#D1D5DB'}` }}>
                {/* sucursal header */}
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, background: BL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{sucIcon}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: suc.activo ? '#111827' : '#9CA3AF' }}>{suc.nombre}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{deps.length} depósito{deps.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => openCrearDep(suc.id)} style={{ padding: '5px 10px', background: BL, border: `1px solid #BFDBFE`, color: B, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      + Depósito
                    </button>
                    <button onClick={() => openEditarSuc(suc)} style={{ padding: '5px 10px', background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Editar
                    </button>
                    <button onClick={() => { toggleSucursal(suc.id, !suc.activo).then(loadData) }} style={{ padding: '5px 10px', background: suc.activo ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${suc.activo ? '#FECACA' : '#BBF7D0'}`, color: suc.activo ? '#DC2626' : '#16A34A', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {suc.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>

                {/* depósitos de esta sucursal */}
                {deps.length > 0 && (
                  <div style={{ borderTop: '1px solid #F3F4F6' }}>
                    {deps.map((dep, i) => (
                      <div key={dep.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px 10px 60px', borderBottom: i < deps.length - 1 ? '1px solid #F9FAFB' : 'none', background: dep.activo ? '#FAFAFA' : '#F3F4F6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 26, height: 26, background: BL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{depIcon}</div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: dep.activo ? '#374151' : '#9CA3AF' }}>{dep.nombre}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEditarDep(dep)} style={{ padding: '4px 8px', background: BL, border: `1px solid #BFDBFE`, color: B, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Editar</button>
                          <button onClick={() => { toggleDeposito(dep.id, !dep.activo).then(loadData) }} style={{ padding: '4px 8px', background: dep.activo ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${dep.activo ? '#FECACA' : '#BBF7D0'}`, color: dep.activo ? '#DC2626' : '#16A34A', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            {dep.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {deps.length === 0 && (
                  <div style={{ padding: '10px 18px 10px 60px', borderTop: '1px solid #F3F4F6', fontSize: 12, color: '#9CA3AF' }}>
                    Sin depósitos. Usá "+ Depósito" para agregar uno.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* depósitos sin sucursal */}
      {depositos.filter(d => !d.sucursal_id).length > 0 && (
        <div style={{ marginTop: 16, background: '#fff', border: '1px solid #FDE68A', borderLeft: '4px solid #F59E0B' }}>
          <div style={{ padding: '12px 18px', fontSize: 13, fontWeight: 700, color: '#92400E' }}>⚠ Depósitos sin sucursal asignada</div>
          {depositos.filter(d => !d.sucursal_id).map((dep, i, arr) => (
            <div key={dep.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderTop: '1px solid #FEF3C7' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{dep.nombre}</span>
              <button onClick={() => openEditarDep(dep)} style={{ padding: '4px 10px', background: BL, border: `1px solid #BFDBFE`, color: B, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Asignar sucursal</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal Sucursal ── */}
      {modalSuc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="sup" style={{ background: '#fff', width: '100%', maxWidth: 400, borderTop: `3px solid ${B}` }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{editSuc ? 'Editar sucursal' : 'Nueva sucursal'}</div>
              <button onClick={() => setModalSuc(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6B7280' }}>✕</button>
            </div>
            <form onSubmit={handleSucursal} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>Nombre *</div>
                <input autoFocus autoComplete="off" value={nomSuc} onChange={e => setNomSuc(e.target.value)} placeholder="Ej: Sucursal Centro"
                  style={inputStyle(false)}
                  onFocus={e => e.target.style.borderColor = B} onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
              </div>
              {errSuc && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '8px 12px', fontSize: 13, color: '#DC2626' }}>✕ {errSuc}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setModalSuc(false)} style={{ flex: 1, padding: '11px 0', background: '#F3F4F6', border: 'none', fontWeight: 600, fontSize: 13, color: '#374151', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={savingSuc} style={{ flex: 2, padding: '11px 0', background: savingSuc ? `${B}99` : B, color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: savingSuc ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {savingSuc ? <><Spinner /> Guardando...</> : `✓ ${editSuc ? 'Guardar' : 'Crear'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Depósito ── */}
      {modalDep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="sup" style={{ background: '#fff', width: '100%', maxWidth: 400, borderTop: `3px solid ${B}` }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{editDep ? 'Editar depósito' : 'Nuevo depósito'}</div>
              <button onClick={() => setModalDep(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6B7280' }}>✕</button>
            </div>
            <form onSubmit={handleDeposito} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>Sucursal *</div>
                <select value={sucDep} onChange={e => setSucDep(e.target.value)}
                  style={{ width: '100%', height: 42, border: `2px solid ${sucDep ? B : '#E5E7EB'}`, padding: '0 12px', fontSize: 14, color: sucDep ? '#111827' : '#9CA3AF', background: '#F9FAFB', appearance: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
                  <option value="">Seleccioná una sucursal...</option>
                  {sucursales.filter(s => s.activo).map(s => <option key={s.id} value={String(s.id)}>{s.nombre}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>Nombre *</div>
                <input autoFocus autoComplete="off" value={nomDep} onChange={e => setNomDep(e.target.value)} placeholder="Ej: Depósito Principal"
                  style={inputStyle(false)}
                  onFocus={e => e.target.style.borderColor = B} onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
              </div>
              {errDep && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '8px 12px', fontSize: 13, color: '#DC2626' }}>✕ {errDep}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setModalDep(false)} style={{ flex: 1, padding: '11px 0', background: '#F3F4F6', border: 'none', fontWeight: 600, fontSize: 13, color: '#374151', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={savingDep} style={{ flex: 2, padding: '11px 0', background: savingDep ? `${B}99` : B, color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: savingDep ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {savingDep ? <><Spinner /> Guardando...</> : `✓ ${editDep ? 'Guardar' : 'Crear'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
