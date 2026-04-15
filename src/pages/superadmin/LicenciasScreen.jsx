import { useState, useEffect, useCallback } from 'react'
import { getLicencias, crearLicencia, toggleLicencia, getUsuariosCliente, resetPassword } from '../../services/vendorService'
import { B, BL } from '../../constants/theme'

const ROL_LABEL = { admin: 'Admin', contador: 'Contador', superadmin: 'Superadmin' }
const ROL_COLOR = {
  admin:      { bg: '#DBEAFE', c: '#1D4ED8' },
  contador:   { bg: '#D1FAE5', c: '#059669' },
  superadmin: { bg: BL,        c: B          },
}

function Spin({ color = B, size = 22 }) {
  return (
    <div className="spin" style={{ width: size, height: size, border: `2.5px solid #E5E7EB`, borderTopColor: color, borderRadius: '50%', flexShrink: 0 }} />
  )
}

function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const FORM_VACIO = { nombre_empresa: '', email_admin: '', nombre_admin: '' }

export default function LicenciasScreen() {
  const [clientes,  setClientes]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  // Modal crear
  const [showCrear, setShowCrear] = useState(false)
  const [form,      setForm]      = useState(FORM_VACIO)
  const [saving,    setSaving]    = useState(false)
  const [formErr,   setFormErr]   = useState('')
  const [created,   setCreated]   = useState(null)

  // Panel usuarios
  const [panelCliente, setPanelCliente] = useState(null)
  const [usuarios,     setUsuarios]     = useState([])
  const [loadingU,     setLoadingU]     = useState(false)

  const [toggling,   setToggling]   = useState(null)
  const [resetting,  setResetting]  = useState(null)  // user_id en proceso
  const [resetResult, setResetResult] = useState({})  // { [user_id]: newPassword }

  const loadData = useCallback(async () => {
    setLoading(true); setError('')
    try { setClientes(await getLicencias()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  /* ── Crear ── */
  const handleCrear = async e => {
    e.preventDefault()
    if (!form.nombre_empresa.trim() || !form.email_admin.trim()) { setFormErr('Nombre de empresa y email son requeridos.'); return }
    if (!form.email_admin.includes('@')) { setFormErr('Email inválido.'); return }
    setSaving(true); setFormErr('')
    try {
      const result = await crearLicencia(form)
      setCreated(result)
      await loadData()
    } catch (e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  const cerrarModalCrear = () => { setShowCrear(false); setForm(FORM_VACIO); setFormErr(''); setCreated(null) }

  /* ── Toggle ── */
  const handleToggle = async (lic) => {
    setToggling(lic.id)
    try {
      await toggleLicencia(lic.id, !lic.activa)
      setClientes(prev => prev.map(c => ({
        ...c,
        licencias: c.licencias.map(l => l.id === lic.id ? { ...l, activa: !l.activa } : l),
      })))
    } catch (e) { alert(e.message) }
    finally { setToggling(null) }
  }

  /* ── Reset contraseña ── */
  const handleReset = async (userId) => {
    setResetting(userId)
    try {
      const { password } = await resetPassword(userId)
      setResetResult(prev => ({ ...prev, [userId]: password }))
    } catch (e) { alert(e.message) }
    finally { setResetting(null) }
  }

  /* ── Ver usuarios ── */
  const abrirUsuarios = async (cliente) => {
    setPanelCliente(cliente); setUsuarios([]); setLoadingU(true)
    try { setUsuarios(await getUsuariosCliente(cliente.id)) }
    catch { /* silencioso */ }
    finally { setLoadingU(false) }
  }

  const totalActivas   = clientes.reduce((s, c) => s + c.licencias.filter(l => l.activa).length, 0)
  const totalInactivas = clientes.reduce((s, c) => s + c.licencias.filter(l => !l.activa).length, 0)

  /* ── Input style helper ── */
  const inputStyle = { width: '100%', height: 44, border: '2px solid #E5E7EB', padding: '0 12px', fontSize: 14, color: '#111827', background: '#F9FAFB', boxSizing: 'border-box', outline: 'none' }

  return (
    <div style={{ padding: '28px 28px', maxWidth: 960, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>Gestión de Licencias</div>
          {!loading && (
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>
              {clientes.length} cliente{clientes.length !== 1 ? 's' : ''} · {totalActivas} activa{totalActivas !== 1 ? 's' : ''} · {totalInactivas} inactiva{totalInactivas !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowCrear(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: B, color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"><line x1={12} y1={5} x2={12} y2={19}/><line x1={5} y1={12} x2={19} y2={12}/></svg>
          Nueva licencia
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 56 }}>
          <Spin size={28} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '12px 16px', color: '#DC2626', fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
          ✕ {error}
        </div>
      )}

      {/* Vacío */}
      {!loading && !error && clientes.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderTop: `3px solid ${B}`, padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
          No hay clientes aún. Creá la primera licencia.
        </div>
      )}

      {/* Lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {clientes.map(c => (
          <div key={c.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderTop: `3px solid ${B}` }}>

            {/* Cliente header */}
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, background: BL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth="2.2" strokeLinecap="square">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>{c.nombre}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                    Desde {fmtFecha(c.created_at)} · {c.usuarios} usuario{c.usuarios !== 1 ? 's' : ''} · {c.terminales} terminal{c.terminales !== 1 ? 'es' : ''}
                  </div>
                </div>
              </div>
              <button
                onClick={() => abrirUsuarios(c)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#F9FAFB', border: '1px solid #E5E7EB', fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx={9} cy={7} r={4}/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                Ver usuarios
              </button>
            </div>

            {/* Licencias */}
            <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {c.licencias.length === 0 && (
                <div style={{ fontSize: 13, color: '#9CA3AF' }}>Sin licencias</div>
              )}
              {c.licencias.map(lic => (
                <div key={lic.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: lic.activa ? '#F9FAFB' : '#FEF2F2', border: `1px solid ${lic.activa ? '#E5E7EB' : '#FECACA'}`, flexWrap: 'wrap' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 700, color: lic.activa ? B : '#9CA3AF', letterSpacing: '0.1em', flex: '0 0 auto' }}>
                    {lic.codigo}
                  </div>
                  <div style={{ padding: '3px 10px', background: lic.activa ? '#D1FAE5' : '#FEE2E2', color: lic.activa ? '#059669' : '#DC2626', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {lic.activa ? 'Activa' : 'Inactiva'}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', flex: 1 }}>Creada {fmtFecha(lic.created_at)}</div>
                  <button
                    onClick={() => handleToggle(lic)}
                    disabled={toggling === lic.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: lic.activa ? '#FEF2F2' : '#D1FAE5', border: `1px solid ${lic.activa ? '#FECACA' : '#6EE7B7'}`, color: lic.activa ? '#DC2626' : '#059669', fontSize: 12, fontWeight: 600, cursor: toggling === lic.id ? 'not-allowed' : 'pointer', opacity: toggling === lic.id ? 0.6 : 1 }}
                  >
                    {toggling === lic.id
                      ? <Spin size={12} color={lic.activa ? '#DC2626' : '#059669'} />
                      : lic.activa
                        ? <><svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><line x1={18} y1={6} x2={6} y2={18}/><line x1={6} y1={6} x2={18} y2={18}/></svg> Desactivar</>
                        : <><svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><path d="M20 6L9 17l-5-5"/></svg> Activar</>
                    }
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ══ Modal Crear ══ */}
      {showCrear && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', borderTop: `3px solid ${B}` }}>
            {!created ? (
              <>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 700, fontSize: 17, color: '#111827' }}>Nueva licencia</div>
                  <button onClick={cerrarModalCrear} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#6B7280', lineHeight: 1 }}>×</button>
                </div>

                <form onSubmit={handleCrear} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { key: 'nombre_empresa', label: 'NOMBRE DE LA EMPRESA *', placeholder: 'Ej: Supermercado López' },
                    { key: 'email_admin',    label: 'EMAIL DEL ADMIN *',      placeholder: 'admin@empresa.com' },
                    { key: 'nombre_admin',   label: 'NOMBRE DEL ADMIN',       placeholder: 'Ej: Juan López' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>{label}</label>
                      <input
                        type={key === 'email_admin' ? 'email' : 'text'}
                        value={form[key]}
                        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        style={inputStyle}
                        onFocus={e => e.target.style.borderColor = B}
                        onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                      />
                    </div>
                  ))}

                  <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '10px 14px', fontSize: 13, color: '#166534' }}>
                    ✓ Se generará un código de activación y contraseña aleatorios. Aparecerán al finalizar.
                  </div>

                  {formErr && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', fontSize: 13, color: '#DC2626', fontWeight: 500 }}>
                      ✕ {formErr}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <button type="button" onClick={cerrarModalCrear} style={{ flex: 1, padding: '12px 0', background: '#F3F4F6', border: 'none', fontWeight: 600, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                    <button type="submit" disabled={saving} style={{ flex: 2, padding: '12px 0', background: saving ? `${B}99` : B, border: 'none', fontWeight: 700, fontSize: 13, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {saving ? <><Spin size={14} color="#fff" /> Creando...</> : 'Crear licencia'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 700, fontSize: 17, color: '#111827' }}>¡Licencia creada!</div>
                  <button onClick={cerrarModalCrear} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#6B7280', lineHeight: 1 }}>×</button>
                </div>
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Código de activación */}
                  <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', padding: '16px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#065F46', letterSpacing: '0.08em', marginBottom: 8 }}>CÓDIGO DE ACTIVACIÓN</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 32, fontWeight: 700, color: '#059669', letterSpacing: '0.12em' }}>
                      {created.licencia?.codigo}
                    </div>
                  </div>

                  {/* Contraseña del admin */}
                  <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', padding: '16px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', letterSpacing: '0.08em', marginBottom: 8 }}>CONTRASEÑA DEL ADMIN</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 28, fontWeight: 700, color: '#B45309', letterSpacing: '0.12em' }}>
                      {created.password}
                    </div>
                  </div>

                  {/* Datos del cliente */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {[
                      { label: 'Empresa',      value: created.cliente?.nombre },
                      { label: 'Nombre admin', value: form.nombre_admin?.trim() || 'Admin' },
                      { label: 'Email admin',  value: created.email },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                        <span style={{ color: '#6B7280', fontWeight: 600 }}>{label}</span>
                        <span style={{ color: '#111827', fontWeight: 500 }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
                    Guardá esta contraseña — no se vuelve a mostrar
                  </div>

                  <button onClick={cerrarModalCrear} style={{ padding: '13px 0', background: B, border: 'none', fontWeight: 700, fontSize: 13, color: '#fff', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Listo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ Panel lateral usuarios ══ */}
      {panelCliente && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, background: '#fff', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `3px solid ${B}`, position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{panelCliente.nombre}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Usuarios del cliente</div>
              </div>
              <button onClick={() => { setPanelCliente(null); setResetResult({}) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#6B7280' }}>×</button>
            </div>

            <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto' }}>
              {loadingU && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                  <Spin size={22} />
                </div>
              )}
              {!loadingU && usuarios.length === 0 && (
                <div style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 32 }}>Sin usuarios registrados</div>
              )}
              {!loadingU && usuarios.map((u, idx) => {
                const rs = ROL_COLOR[u.rol] || { bg: '#F3F4F6', c: '#6B7280' }
                const esPrimero = idx === 0 && u.contrasena_inicial
                const nuevaPass = resetResult[u.id]
                const isResetting = resetting === u.id
                return (
                  <div key={u.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    {/* Fila usuario */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
                      <div style={{ width: 36, height: 36, background: BL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={B} strokeWidth="2.2" strokeLinecap="square"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx={12} cy={7} r={4}/></svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nombre}</div>
                        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                      </div>
                      <div style={{ padding: '3px 8px', background: rs.bg, color: rs.c, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>
                        {ROL_LABEL[u.rol] || u.rol}
                      </div>
                      {/* Botón reset */}
                      <button
                        onClick={() => handleReset(u.id)}
                        disabled={isResetting}
                        title="Resetear contraseña"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: '#F3F4F6', border: '1px solid #E5E7EB', fontSize: 11, fontWeight: 600, color: '#374151', cursor: isResetting ? 'not-allowed' : 'pointer', opacity: isResetting ? 0.6 : 1, flexShrink: 0 }}
                      >
                        {isResetting
                          ? <Spin size={11} color="#6B7280" />
                          : <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                        }
                        Reset
                      </button>
                    </div>

                    {/* Contraseña inicial (primer usuario) */}
                    {esPrimero && !nuevaPass && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 10px 0', padding: '8px 12px', background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#92400E', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Contraseña inicial</span>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 14, color: '#B45309', letterSpacing: '0.06em' }}>{u.contrasena_inicial}</span>
                      </div>
                    )}

                    {/* Nueva contraseña tras reset */}
                    {nuevaPass && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 10px 0', padding: '8px 12px', background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#92400E', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Nueva contraseña</span>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 14, color: '#B45309', letterSpacing: '0.06em' }}>{nuevaPass}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
