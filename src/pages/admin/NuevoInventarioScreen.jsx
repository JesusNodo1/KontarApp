import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { B, BD, BL } from '../../constants/theme'
import {
  getSucursales, getDepositos, getAdmins,
  getProductosAdmin, crearInventario,
} from '../../services/adminService'
import { getProductosDeDeposito } from '../../services/apiExternaService'
import { useAuth } from '../../context/AuthContext'
import Spinner from '../../components/Spinner'

const inputBase = {
  width: '100%', height: 44, border: '2px solid #E5E7EB', padding: '0 14px',
  fontSize: 14, color: '#111827', background: '#F9FAFB', boxSizing: 'border-box',
}
const labelStyle = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: '#6B7280', marginBottom: 6,
}

export default function NuevoInventarioScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const apiHabilitada = user?.fuente_sync === 'api'

  const [step, setStep] = useState(1)
  const [prodLoading, setProdLoading] = useState(false)
  const [form, setForm] = useState({ nombre: '', sucursal: '', deposito: '', deposito_id: null, responsable: '' })

  const [sucursales, setSucursales] = useState([])
  const [depositos,  setDepositos]  = useState([])
  const [admins,     setAdmins]     = useState([])
  const [productos,  setProductos]  = useState([])
  const [loading,    setLoading]    = useState(true)

  // paso 2
  const [modo,        setModo]        = useState('todos')   // 'todos' | 'clasificacion' | 'puntual'
  const [selClas,     setSelClas]     = useState(() => new Set())   // clasificaciones (valor de variante) tildadas
  const [selProds,    setSelProds]    = useState(() => new Set())
  const [busqueda,    setBusqueda]    = useState('')
  const [fuenteMsg,   setFuenteMsg]   = useState('')   // de dónde salieron los productos del paso 2

  const [saving,   setSaving]   = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [sucs, deps, adms] = await Promise.all([
        getSucursales(), getDepositos(), getAdmins(),
      ])
      if (!alive) return
      setSucursales(sucs)
      setDepositos(deps)
      setAdmins(adms)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  // Clasificaciones = valores distintos de `variante`, con cantidad de productos.
  const clasificaciones = useMemo(() => {
    const m = new Map()
    for (const p of productos) {
      const c = (p.variante || '').trim()
      if (!c) continue
      m.set(c, (m.get(c) || 0) + 1)
    }
    return [...m.entries()].map(([nombre, count]) => ({ nombre, count })).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [productos])

  const sucObj        = sucursales.find(s => s.nombre === form.sucursal)
  const depsFiltrados = sucObj ? depositos.filter(d => d.sucursal_id === sucObj.id) : []

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return productos
    return productos.filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.codigo_barras || '').toLowerCase().includes(q) ||
      (p.variante || '').toLowerCase().includes(q)
    )
  }, [productos, busqueda])

  // IDs de productos que caen dentro de las clasificaciones tildadas.
  const idsDeClasificacion = useMemo(() => {
    if (selClas.size === 0) return []
    return productos.filter(p => selClas.has((p.variante || '').trim())).map(p => p.id)
  }, [productos, selClas])

  // Cantidad de productos seleccionados según el modo activo.
  const totalSeleccionados =
    modo === 'todos'   ? productos.length :
    modo === 'puntual' ? selProds.size :
                         idsDeClasificacion.length

  const toggleProd = (id) => {
    setSelProds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  const toggleClas = (nombre) => {
    setSelClas(prev => {
      const n = new Set(prev)
      n.has(nombre) ? n.delete(nombre) : n.add(nombre)
      return n
    })
  }

  const catalogoActivo = async () => (await getProductosAdmin()).filter(p => p.activo)

  const irAPaso2 = async () => {
    if (!form.nombre.trim() || !form.sucursal) { setErrorMsg('Nombre y sucursal son obligatorios.'); return }
    setErrorMsg(''); setFuenteMsg('')
    // El universo de productos depende del depósito → limpiamos la selección previa.
    setSelProds(new Set()); setSelClas(new Set())
    setProdLoading(true)
    setStep(2)
    try {
      let lista = []
      let fuente = ''
      if (apiHabilitada && form.deposito_id) {
        // Pedimos a la API el stock de ese depósito (KONTAR_STOCK) y nos quedamos
        // con los productos que existen ahí. Si la API no devuelve nada o falla,
        // caemos al catálogo completo para que el wizard siga siendo usable.
        try {
          lista = await getProductosDeDeposito(form.deposito_id)
          if (lista.length > 0) {
            fuente = `${lista.length} productos con stock en el depósito ${form.deposito}.`
          } else {
            lista = await catalogoActivo()
            fuente = `La API no devolvió stock para el depósito ${form.deposito}. Mostrando el catálogo completo (${lista.length}).`
          }
        } catch (e) {
          lista = await catalogoActivo()
          fuente = `No se pudo consultar el stock del depósito (${e.message}). Mostrando el catálogo completo (${lista.length}).`
        }
      } else {
        lista = await catalogoActivo()
        fuente = apiHabilitada
          ? `Sin depósito específico: catálogo completo (${lista.length}).`
          : `${lista.length} productos del catálogo.`
      }
      setProductos(lista)
      setFuenteMsg(fuente)
      setModo('todos')
    } catch (e) {
      setProductos([])
      setErrorMsg(`No se pudieron traer los productos: ${e.message}`)
    } finally {
      setProdLoading(false)
    }
  }

  const handleCrear = async () => {
    let productoIds
    if (modo === 'todos') {
      // [] = sin restricción → el snapshot teórico cubre todo el depósito.
      if (productos.length === 0) { setErrorMsg('No hay productos para contar.'); return }
      productoIds = []
    } else {
      productoIds = modo === 'puntual' ? [...selProds] : idsDeClasificacion
      if (productoIds.length === 0) { setErrorMsg('Elegí al menos un producto para contar.'); return }
    }

    setSaving(true); setErrorMsg('')
    try {
      await crearInventario({ ...form, productoIds })
      navigate('/admin/inventarios')
    } catch (e) {
      setErrorMsg(e.message)
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 760, margin: '0 auto' }}>
      {/* breadcrumb */}
      <button
        onClick={() => navigate('/admin/inventarios')}
        style={{ background: 'none', border: 'none', color: B, cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 14, padding: 0 }}
      >
        ← Inventarios
      </button>

      <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 18 }}>Nuevo inventario</div>

      {/* stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
        <Paso n={1} label="Ubicación" activo={step === 1} hecho={step > 1} onClick={() => setStep(1)} />
        <div style={{ flex: 1, height: 2, background: step > 1 ? B : '#E5E7EB' }} />
        <Paso n={2} label="Productos" activo={step === 2} hecho={false} onClick={step > 1 ? undefined : undefined} />
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', padding: '22px' }}>
        {step === 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Sucursal */}
            <div>
              <div style={labelStyle}>Sucursal *</div>
              <select
                value={form.sucursal}
                onChange={e => setForm(f => ({ ...f, sucursal: e.target.value, deposito: '', deposito_id: null }))}
                style={{ ...inputBase, color: form.sucursal ? '#111827' : '#9CA3AF', appearance: 'none', cursor: 'pointer' }}
              >
                <option value="">Seleccioná una sucursal...</option>
                {sucursales.map(s => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
              </select>
              {sucursales.length === 0 && <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 4 }}>⚠ No hay sucursales. Agregá desde Configuración › Sucursales.</div>}
            </div>

            {/* Depósito */}
            <div>
              <div style={labelStyle}>Depósito</div>
              <select
                value={form.deposito}
                onChange={e => {
                  const nombre = e.target.value
                  const dep = depsFiltrados.find(d => d.nombre === nombre)
                  setForm(f => ({ ...f, deposito: nombre, deposito_id: dep?.id || null }))
                }}
                disabled={!form.sucursal}
                style={{ ...inputBase, color: form.deposito ? '#111827' : '#9CA3AF', background: form.sucursal ? '#F9FAFB' : '#F3F4F6', appearance: 'none', cursor: form.sucursal ? 'pointer' : 'not-allowed' }}
              >
                <option value="">{form.sucursal ? 'Sin depósito específico' : 'Seleccioná primero una sucursal'}</option>
                {depsFiltrados.map(d => <option key={d.id} value={d.nombre}>{d.nombre}</option>)}
              </select>
              {form.sucursal && depsFiltrados.length === 0 && <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 4 }}>⚠ Esta sucursal no tiene depósitos.</div>}
            </div>

            {/* Nombre */}
            <div>
              <div style={labelStyle}>Nombre del inventario *</div>
              <input
                type="text" placeholder="Ej: Depósito Central — Conteo mensual" value={form.nombre} autoComplete="off"
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                style={inputBase}
              />
            </div>

            {/* Responsable */}
            <div>
              <div style={labelStyle}>Responsable</div>
              <select
                value={form.responsable}
                onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))}
                style={{ ...inputBase, color: form.responsable ? '#111827' : '#9CA3AF', appearance: 'none', cursor: 'pointer' }}
              >
                <option value="">Seleccioná un responsable...</option>
                {admins.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
              </select>
            </div>

            {errorMsg && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', fontSize: 13, color: '#DC2626' }}>✕ {errorMsg}</div>}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <button onClick={() => navigate('/admin/inventarios')} style={{ background: 'none', border: 'none', color: '#6B7280', fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: 0 }}>Cancelar</button>
              <button
                onClick={irAPaso2}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', background: B, border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                Siguiente <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 6 }}>
              ¿Qué entra al conteo? Un <b>conteo general</b> (todos), por <b>clasificación</b>, o <b>productos puntuales</b>.
            </div>
            {fuenteMsg && !prodLoading && (
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 14, background: '#F9FAFB', border: '1px solid #E5E7EB', padding: '8px 12px' }}>{fuenteMsg}</div>
            )}

            {prodLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
            ) : productos.length === 0 ? (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '16px', fontSize: 13, color: '#92400E', lineHeight: 1.5 }}>
                No hay productos para mostrar. {apiHabilitada ? 'Sincronizá productos desde Configuración → Sincronizar API.' : 'Cargá productos desde Configuración → Productos.'}
              </div>
            ) : (
            <>
            {/* tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <TabBtn activo={modo === 'todos'} onClick={() => setModo('todos')}>Todos (conteo general)</TabBtn>
              <TabBtn activo={modo === 'clasificacion'} onClick={() => setModo('clasificacion')}>Por clasificación</TabBtn>
              <TabBtn activo={modo === 'puntual'} onClick={() => setModo('puntual')}>Productos puntuales</TabBtn>
            </div>

            {modo === 'todos' ? (
              <div style={{ border: `2px solid ${B}`, background: BL, padding: '18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, background: B, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><path d="M20 6L9 17l-5-5"/></svg>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Conteo general — {productos.length} producto{productos.length !== 1 ? 's' : ''}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Se cuentan todos los productos del depósito. No hace falta seleccionar nada.</div>
                </div>
              </div>
            ) : modo === 'clasificacion' ? (
              clasificaciones.length === 0 ? (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '16px', fontSize: 13, color: '#92400E', lineHeight: 1.5 }}>
                  Los productos de este depósito no tienen clasificación cargada. Elegí desde <b>Productos puntuales</b>.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {clasificaciones.map(c => {
                    const on = selClas.has(c.nombre)
                    return (
                      <div key={c.nombre} onClick={() => toggleClas(c.nombre)}
                        style={{ cursor: 'pointer', border: `2px solid ${on ? B : '#E5E7EB'}`, background: on ? BL : '#fff', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Check on={on} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</div>
                          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{c.count} producto{c.count !== 1 ? 's' : ''}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : (
              <>
                <input
                  type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, código de barras o SKU..."
                  style={{ ...inputBase, marginBottom: 12 }}
                />
                <div style={{ border: '1px solid #E5E7EB', maxHeight: 360, overflowY: 'auto' }}>
                  {productosFiltrados.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Sin resultados.</div>
                  ) : (
                    productosFiltrados.slice(0, 300).map((p, i) => {
                      const on = selProds.has(p.id)
                      return (
                        <div key={p.id} onClick={() => toggleProd(p.id)}
                          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid #F3F4F6', background: on ? BL : (i % 2 ? '#FAFAFA' : '#fff') }}>
                          <Check on={on} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 500, fontSize: 14, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.nombre}{p.variante ? <span style={{ color: '#9CA3AF', fontWeight: 400 }}> · {p.variante}</span> : null}
                            </div>
                            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, fontFamily: "'DM Mono',monospace" }}>
                              {p.sku ? `SKU ${p.sku}` : 'Sin SKU'}{p.codigo_barras ? ` · ${p.codigo_barras}` : ''}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                {productosFiltrados.length > 300 && (
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>Mostrando 300 de {productosFiltrados.length}. Afiná la búsqueda para ver más.</div>
                )}
              </>
            )}
            </>
            )}

            {errorMsg && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', fontSize: 13, color: '#DC2626', marginTop: 14 }}>✕ {errorMsg}</div>}

            {/* footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
              <button onClick={() => { setStep(1); setErrorMsg('') }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid #D1D5DB', color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: '10px 16px' }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><path d="M15 18l-6-6 6-6"/></svg> Atrás
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 13, color: '#6B7280' }}><b style={{ color: '#111827', fontFamily: "'DM Mono',monospace" }}>{totalSeleccionados}</b> productos {modo === 'todos' ? '(todos)' : 'seleccionados'}</span>
                <button
                  onClick={handleCrear}
                  disabled={saving || totalSeleccionados === 0}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', background: (saving || totalSeleccionados === 0) ? '#93C5FD' : B, border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, cursor: (saving || totalSeleccionados === 0) ? 'not-allowed' : 'pointer' }}
                >
                  {saving ? <><Spinner /> Creando...</> : 'Crear inventario'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Paso({ n, label, activo, hecho }) {
  const color = activo || hecho ? B : '#9CA3AF'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 24, height: 24, borderRadius: 2, background: activo ? B : (hecho ? BD : '#E5E7EB'), color: activo || hecho ? '#fff' : '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{n}</div>
      <div style={{ fontSize: 13, fontWeight: activo ? 700 : 500, color }}>{label}</div>
    </div>
  )
}

function TabBtn({ activo, onClick, children }) {
  return (
    <button onClick={onClick} style={{ padding: '8px 16px', background: activo ? BL : '#fff', border: `2px solid ${activo ? B : '#E5E7EB'}`, color: activo ? B : '#6B7280', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
      {children}
    </button>
  )
}

function Check({ on }) {
  return (
    <div style={{ width: 20, height: 20, flexShrink: 0, border: `2px solid ${on ? B : '#D1D5DB'}`, background: on ? B : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {on && <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="square"><path d="M20 6L9 17l-5-5"/></svg>}
    </div>
  )
}
