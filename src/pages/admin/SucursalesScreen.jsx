import { useState, useEffect, useCallback } from 'react'
import { B, BL } from '../../constants/theme'
import {
  getSucursales, crearSucursal, editarSucursal, toggleSucursal,
  getDepositos,  crearDeposito,  editarDeposito,  toggleDeposito,
} from '../../services/adminService'
import Spinner from '../../components/Spinner'

// ── Componente reutilizable para cada sección ────────────────
function CatalogoSection({ title, icon, items, loading, onCreate, onEdit, onToggle }) {
  const [showModal, setShowModal] = useState(false)
  const [editItem,  setEditItem]  = useState(null)   // { id, nombre }
  const [nombre,    setNombre]    = useState('')
  const [saving,    setSaving]    = useState(false)
  const [errorMsg,  setErrorMsg]  = useState('')

  const openCrear = () => { setEditItem(null); setNombre(''); setErrorMsg(''); setShowModal(true) }
  const openEditar = (item) => { setEditItem(item); setNombre(item.nombre); setErrorMsg(''); setShowModal(true) }
  const closeModal = () => setShowModal(false)

  const handleSubmit = async e => {
    e.preventDefault()
    const val = nombre.trim()
    if (!val) { setErrorMsg('El nombre es obligatorio.'); return }
    setSaving(true); setErrorMsg('')
    try {
      if (editItem) await onEdit(editItem.id, val)
      else          await onCreate(val)
      setShowModal(false)
    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', marginBottom: 24 }}>
      {/* header sección */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: BL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{title}</div>
          <span style={{ background: BL, color: B, border: `1px solid #BFDBFE`, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
            {items.filter(i => i.activo).length} activos
          </span>
        </div>
        <button
          onClick={openCrear}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: B, border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"><line x1={12} y1={5} x2={12} y2={19}/><line x1={5} y1={12} x2={19} y2={12}/></svg>
          Agregar
        </button>
      </div>

      {/* lista */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner /></div>
      ) : items.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
          No hay {title.toLowerCase()} cargadas. Agregá la primera.
        </div>
      ) : (
        <div>
          {items.map((item, i) => (
            <div
              key={item.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 20px',
                borderBottom: i < items.length - 1 ? '1px solid #F3F4F6' : 'none',
                background: item.activo ? '#fff' : '#F9FAFB',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.activo ? '#10B981' : '#D1D5DB', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: 14, color: item.activo ? '#111827' : '#9CA3AF' }}>{item.nombre}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => openEditar(item)}
                  style={{ padding: '5px 10px', background: BL, border: `1px solid #BFDBFE`, color: B, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Editar
                </button>
                <button
                  onClick={() => onToggle(item.id, !item.activo)}
                  style={{ padding: '5px 10px', background: item.activo ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${item.activo ? '#FECACA' : '#BBF7D0'}`, color: item.activo ? '#DC2626' : '#16A34A', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  {item.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* modal crear/editar */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="sup" style={{ background: '#fff', width: '100%', maxWidth: 400, borderTop: `3px solid ${B}` }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>
                {editItem ? `Editar ${title.slice(0, -1).toLowerCase()}` : `Nueva ${title.slice(0, -1).toLowerCase()}`}
              </div>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6B7280', lineHeight: 1 }}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>Nombre *</div>
                <input
                  autoFocus
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder={`Ej: ${title === 'Sucursales' ? 'Sucursal Centro' : 'Depósito Norte'}`}
                  style={{ width: '100%', height: 42, border: '2px solid #E5E7EB', padding: '0 12px', fontSize: 14, color: '#111827', background: '#F9FAFB', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = B}
                  onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                />
              </div>
              {errorMsg && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '8px 12px', fontSize: 13, color: '#DC2626' }}>✕ {errorMsg}</div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={closeModal} style={{ flex: 1, padding: '11px 0', background: '#F3F4F6', border: 'none', fontWeight: 600, fontSize: 13, color: '#374151', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{ flex: 2, padding: '11px 0', background: saving ? `${B}99` : B, color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {saving ? <><Spinner /> Guardando...</> : `✓ ${editItem ? 'Guardar cambios' : 'Crear'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Pantalla principal ───────────────────────────────────────
export default function SucursalesScreen() {
  const [sucursales, setSucursales] = useState([])
  const [depositos,  setDepositos]  = useState([])
  const [loading,    setLoading]    = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [s, d] = await Promise.all([getSucursales(false), getDepositos(false)])
    setSucursales(s)
    setDepositos(d)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const refresh = () => loadData()

  // sucursales handlers
  const handleCrearSucursal  = async (nombre)      => { await crearSucursal(nombre);       await refresh() }
  const handleEditarSucursal = async (id, nombre)  => { await editarSucursal(id, nombre);  await refresh() }
  const handleToggleSucursal = async (id, activo)  => { await toggleSucursal(id, activo);  await refresh() }

  // depositos handlers
  const handleCrearDeposito  = async (nombre)      => { await crearDeposito(nombre);       await refresh() }
  const handleEditarDeposito = async (id, nombre)  => { await editarDeposito(id, nombre);  await refresh() }
  const handleToggleDeposito = async (id, activo)  => { await toggleDeposito(id, activo);  await refresh() }

  const sucIcon = (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth="2.2" strokeLinecap="square">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
  const depIcon = (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth="2.2" strokeLinecap="square">
      <rect x={1} y={3} width={15} height={13}/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
      <circle cx={5.5} cy={18.5} r={2.5}/><circle cx={18.5} cy={18.5} r={2.5}/>
    </svg>
  )

  return (
    <div style={{ padding: '24px 20px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Sucursales y Depósitos</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Administrá las sucursales y depósitos disponibles para los inventarios.</div>
      </div>

      <CatalogoSection
        title="Sucursales"
        icon={sucIcon}
        items={sucursales}
        loading={loading}
        onCreate={handleCrearSucursal}
        onEdit={handleEditarSucursal}
        onToggle={handleToggleSucursal}
      />

      <CatalogoSection
        title="Depósitos"
        icon={depIcon}
        items={depositos}
        loading={loading}
        onCreate={handleCrearDeposito}
        onEdit={handleEditarDeposito}
        onToggle={handleToggleDeposito}
      />
    </div>
  )
}
