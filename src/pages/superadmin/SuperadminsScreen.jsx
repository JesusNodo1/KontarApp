import { useState, useEffect, useCallback } from 'react'
import { B, BL } from '../../constants/theme'
import Spinner from '../../components/Spinner'

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/superadmin-mgmt`

function _getToken() {
  const key = `sb-${import.meta.env.VITE_SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`
  try { return JSON.parse(localStorage.getItem(key) || '{}').access_token || null } catch { return null }
}

async function apiFetch(method, body) {
  const token = _getToken()
  const res = await fetch(EDGE_URL, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json
}

function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const FORM_VACÍO = { nombre: '', email: '' }

export default function SuperadminsScreen() {
  const [lista,      setLista]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showModal,  setShowModal]  = useState(false)
  const [form,       setForm]       = useState(FORM_VACÍO)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState('')
  const [toggling,   setToggling]   = useState(null)
  const [globalErr,  setGlobalErr]  = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setLista(await apiFetch('GET')) } catch (e) { setGlobalErr(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleCrear = async e => {
    e.preventDefault()
    if (!form.nombre.trim()) { setFormError('Ingresá el nombre.'); return }
    if (!form.email.trim())  { setFormError('Ingresá el email.'); return }
    setSaving(true); setFormError('')
    try {
      await apiFetch('POST', { nombre: form.nombre.trim(), email: form.email.trim() })
      setShowModal(false)
      setForm(FORM_VACÍO)
      await load()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (item) => {
    setToggling(item.id)
    try {
      const updated = await apiFetch('PATCH', { id: item.id, activo: !item.activo })
      setLista(prev => prev.map(s => s.id === updated.id ? updated : s))
    } catch (err) {
      setGlobalErr(err.message)
    } finally {
      setToggling(null)
    }
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 860, margin: '0 auto' }}>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Superadmins</div>
          {!loading && <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{lista.length} registrado{lista.length !== 1 ? 's' : ''}</div>}
        </div>
        <button
          onClick={() => { setShowModal(true); setForm(FORM_VACÍO); setFormError('') }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: B, border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}
        >
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square">
            <line x1={12} y1={5} x2={12} y2={19}/><line x1={5} y1={12} x2={19} y2={12}/>
          </svg>
          Nuevo superadmin
        </button>
      </div>

      {globalErr && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 16 }}>
          ✕ {globalErr}
        </div>
      )}

      {/* tabla */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 2fr 90px 110px 56px', padding: '10px 16px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
            {['Nombre', 'Email', 'Estado', 'Creado', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF' }}>{h}</div>
            ))}
          </div>

          {lista.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>No hay superadmins registrados.</div>
          ) : lista.map((s, i) => (
            <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 2fr 90px 110px 56px', padding: '12px 16px', borderBottom: i < lista.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{s.nombre}</div>
              <div style={{ fontSize: 13, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email}</div>
              <div>
                <span style={{
                  padding: '3px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                  background: s.activo ? '#ECFDF5' : '#F3F4F6',
                  color:      s.activo ? '#065F46' : '#6B7280',
                }}>
                  {s.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>{fmtFecha(s.created_at)}</div>
              <div>
                <button
                  onClick={() => handleToggle(s)}
                  disabled={toggling === s.id}
                  title={s.activo ? 'Desactivar' : 'Activar'}
                  style={{
                    width: 44, height: 28, border: '1px solid #E5E7EB', cursor: toggling === s.id ? 'not-allowed' : 'pointer',
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                    background: s.activo ? '#FEF2F2' : BL,
                    color:      s.activo ? '#DC2626' : B,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {toggling === s.id ? <Spinner /> : s.activo ? 'OFF' : 'ON'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* modal nuevo */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 420, borderTop: `3px solid ${B}` }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Nuevo superadmin</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#6B7280' }}>✕</button>
            </div>
            <form onSubmit={handleCrear} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Nombre completo *', key: 'nombre', type: 'text',  ph: 'Ej: María García' },
                { label: 'Email *',           key: 'email',  type: 'email', ph: 'superadmin@empresa.com' },
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

              <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', padding: '10px 14px', fontSize: 12, color: '#92400E' }}>
                ⚠ El superadmin debe tener su cuenta creada en Supabase Auth para poder iniciar sesión.
              </div>

              {formError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', fontSize: 13, color: '#DC2626' }}>✕ {formError}</div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '13px 0', background: '#F3F4F6', border: 'none', fontWeight: 600, fontSize: 14, color: '#374151', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{ flex: 2, padding: '13px 0', background: saving ? `${B}99` : B, color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {saving ? <><Spinner /> Guardando...</> : '✓ Crear superadmin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
