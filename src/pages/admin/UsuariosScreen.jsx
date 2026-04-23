import { useState, useEffect, useCallback } from 'react'
import { B, BL, G, GL } from '../../constants/theme'
import { getUsuarios, crearUsuario, cambiarPassword } from '../../services/adminService'
import Spinner from '../../components/Spinner'

const ROL_STYLE = {
  admin:    { bg: BL, color: B,         label: 'Admin' },
  contador: { bg: GL, color: '#059669', label: 'Contador' },
}

const FORM_VACÍO = { nombre: '', email: '', password: '', rol: 'contador' }

function fmtFechaCorta(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function UsuariosScreen() {
  const [usuarios,      setUsuarios]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [showModal,     setShowModal]     = useState(false)
  const [form,          setForm]          = useState(FORM_VACÍO)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')

  // modal cambiar contraseña
  const [pwModal,       setPwModal]       = useState(false)
  const [pwUsuario,     setPwUsuario]     = useState(null)   // { id, nombre }
  const [pwNueva,       setPwNueva]       = useState('')
  const [pwSaving,      setPwSaving]      = useState(false)
  const [pwError,       setPwError]       = useState('')
  const [pwOk,          setPwOk]          = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try { setUsuarios(await getUsuarios()) } catch { /* silencioso */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleCrear = async e => {
    e.preventDefault()
    if (!form.nombre || !form.email || !form.password) { setError('Completá todos los campos.'); return }
    if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    setSaving(true); setError('')
    try {
      await crearUsuario(form)
      setShowModal(false)
      setForm(FORM_VACÍO)
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const abrirPwModal = u => {
    setPwUsuario(u)
    setPwNueva('')
    setPwError('')
    setPwOk(false)
    setPwModal(true)
  }

  const handleCambiarPw = async e => {
    e.preventDefault()
    if (!pwNueva) { setPwError('Ingresá la nueva contraseña.'); return }
    if (pwNueva.length < 6) { setPwError('Mínimo 6 caracteres.'); return }
    setPwSaving(true); setPwError(''); setPwOk(false)
    try {
      await cambiarPassword(pwUsuario.id, pwNueva)
      setPwOk(true)
      setPwNueva('')
    } catch (err) {
      setPwError(err.message)
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Usuarios</div>
          {!loading && <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{usuarios.length} en el sistema</div>}
        </div>
        <button
          onClick={() => { setShowModal(true); setForm(FORM_VACÍO); setError('') }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: B, border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}
        >
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"><line x1={12} y1={5} x2={12} y2={19}/><line x1={5} y1={12} x2={19} y2={12}/></svg>
          Nuevo usuario
        </button>
      </div>

      {/* tabla */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 2fr 100px 110px 44px', padding: '10px 16px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
            {['Nombre', 'Email', 'Rol', 'Creado', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF' }}>{h}</div>
            ))}
          </div>
          {usuarios.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>No hay usuarios registrados.</div>
          ) : (
            usuarios.map((u, i) => {
              const rs = ROL_STYLE[u.rol] || ROL_STYLE.contador
              return (
                <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 2fr 100px 110px 44px', padding: '12px 16px', borderBottom: i < usuarios.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{u.nombre}</div>
                  <div style={{ fontSize: 13, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email || '—'}</div>
                  <div>
                    <span style={{ background: rs.bg, color: rs.color, padding: '3px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{rs.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>{fmtFechaCorta(u.created_at)}</div>
                  <div>
                    <button
                      onClick={() => abrirPwModal(u)}
                      title="Cambiar contraseña"
                      style={{ width: 32, height: 32, background: '#F3F4F6', border: '1px solid #E5E7EB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.2" strokeLinecap="square">
                        <rect x={3} y={11} width={18} height={11}/><path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* modal nuevo usuario */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="sup" style={{ background: '#fff', width: '100%', maxWidth: 440, borderTop: `3px solid ${B}` }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Nuevo usuario</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#6B7280' }}>✕</button>
            </div>
            <form onSubmit={handleCrear} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Nombre completo *', key: 'nombre',   type: 'text',     ph: 'Ej: Juan Pérez' },
                { label: 'Email *',           key: 'email',    type: 'email',    ph: 'usuario@empresa.com' },
                { label: 'Contraseña *',      key: 'password', type: 'password', ph: 'Mínimo 6 caracteres' },
              ].map(({ label, key, type, ph }) => (
                <div key={key}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>{label}</div>
                  <input
                    type={type} placeholder={ph} value={form[key]} autoComplete="off"
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', height: 44, border: '2px solid #E5E7EB', padding: '0 14px', fontSize: 14, color: '#111827', background: '#F9FAFB', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = B}
                    onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                  />
                </div>
              ))}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>Rol</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {['contador', 'admin'].map(r => (
                    <button key={r} type="button" onClick={() => setForm(f => ({ ...f, rol: r }))}
                      style={{ flex: 1, padding: '10px 0', border: form.rol === r ? `2px solid ${B}` : '2px solid #E5E7EB', background: form.rol === r ? BL : '#fff', color: form.rol === r ? B : '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer', textTransform: 'capitalize' }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', fontSize: 13, color: '#DC2626' }}>✕ {error}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '13px 0', background: '#F3F4F6', border: 'none', fontWeight: 600, fontSize: 14, color: '#374151', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{ flex: 2, padding: '13px 0', background: saving ? `${B}99` : B, color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {saving ? <><Spinner /> Creando...</> : '✓ Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* modal cambiar contraseña */}
      {pwModal && pwUsuario && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="sup" style={{ background: '#fff', width: '100%', maxWidth: 400, borderTop: `3px solid ${B}` }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Cambiar contraseña</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{pwUsuario.nombre}</div>
              </div>
              <button onClick={() => setPwModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#6B7280' }}>✕</button>
            </div>
            <form onSubmit={handleCambiarPw} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>Nueva contraseña *</div>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={pwNueva}
                  autoComplete="new-password"
                  onChange={e => { setPwNueva(e.target.value); setPwOk(false); setPwError('') }}
                  style={{ width: '100%', height: 44, border: `2px solid ${B}`, padding: '0 14px', fontSize: 14, color: '#111827', background: '#F9FAFB', boxSizing: 'border-box' }}
                />
              </div>
              {pwError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', fontSize: 13, color: '#DC2626' }}>✕ {pwError}</div>
              )}
              {pwOk && (
                <div style={{ background: '#F0FDF4', border: '1px solid #6EE7B7', padding: '10px 14px', fontSize: 13, color: '#065F46', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><path d="M20 6L9 17l-5-5"/></svg>
                  Contraseña actualizada correctamente
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setPwModal(false)} style={{ flex: 1, padding: '13px 0', background: '#F3F4F6', border: 'none', fontWeight: 600, fontSize: 14, color: '#374151', cursor: 'pointer' }}>Cerrar</button>
                <button type="submit" disabled={pwSaving} style={{ flex: 2, padding: '13px 0', background: pwSaving ? `${B}99` : B, color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: pwSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {pwSaving ? <><Spinner /> Guardando...</> : '✓ Cambiar contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
