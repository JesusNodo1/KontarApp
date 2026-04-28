import { useState, useEffect, useCallback, useRef } from 'react'
import { read as xlsxRead, utils as xlsxUtils, writeFile as xlsxWriteFile } from 'xlsx'
import { B, BL, G, GL } from '../../constants/theme'
import {
  getProductosAdmin,
  crearProductoAdmin,
  editarProducto,
  toggleProducto,
  importarProductosCSV,
} from '../../services/adminService'
import { sincronizarTodo } from '../../services/apiExternaService'
import { useAuth } from '../../context/AuthContext'
import Spinner from '../../components/Spinner'

const FORM_VACÍO = { sku: '', nombre: '', variante: '', codigo_barras: '' }

export default function ProductosScreen() {
  const { user } = useAuth()
  const apiHabilitada = user?.fuente_sync === 'api'

  const [productos,  setProductos]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [busqueda,   setBusqueda]   = useState('')
  const [showModal,  setShowModal]  = useState(false)
  const [editando,   setEditando]   = useState(null)   // producto a editar
  const [form,       setForm]       = useState(FORM_VACÍO)
  const [saving,     setSaving]     = useState(false)
  const [errorMsg,   setErrorMsg]   = useState('')
  const [importing,  setImporting]  = useState(false)
  const [importMsg,  setImportMsg]  = useState('')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [syncing,    setSyncing]    = useState(false)
  const [syncMsg,    setSyncMsg]    = useState('')
  const fileRef = useRef(null)

  const handleSincronizarApi = async () => {
    if (!confirm('Sincronizar sucursales, depósitos y productos desde la API externa? Esto puede demorar varios segundos.')) return
    setSyncing(true); setSyncMsg('Iniciando...')
    try {
      const r = await sincronizarTodo(setSyncMsg)
      const partes = [`✓ ${r.sucursales} sucursales`, `${r.depositos} depósitos`, `${r.productos} productos`]
      if (r.sinSucursal > 0) partes.push(`(${r.sinSucursal} depósitos sin sucursal)`)
      if (r.descartadas > 0) partes.push(`(${r.descartadas} productos descartados)`)
      setSyncMsg(partes.join(' · '))
      await loadData()
    } catch (e) {
      setSyncMsg(`✕ ${e.message}`)
    } finally {
      setSyncing(false)
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setProductos(await getProductosAdmin())
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── filtrado ─────────────────────────────────────────────────
  const filtrados = productos.filter(p => {
    if (!mostrarInactivos && !p.activo) return false
    const q = busqueda.toLowerCase()
    return (
      p.nombre.toLowerCase().includes(q) ||
      (p.variante || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.codigo_barras || '').includes(busqueda)
    )
  })

  // ── abrir modal ───────────────────────────────────────────────
  const abrirCrear = () => { setEditando(null); setForm(FORM_VACÍO); setErrorMsg(''); setShowModal(true) }
  const abrirEditar = p => {
    setEditando(p)
    setForm({ sku: p.sku || '', nombre: p.nombre || '', variante: p.variante || '', codigo_barras: p.codigo_barras || '' })
    setErrorMsg('')
    setShowModal(true)
  }

  // ── guardar (crear / editar) ──────────────────────────────────
  const handleGuardar = async e => {
    e.preventDefault()
    if (!form.nombre || !form.codigo_barras) { setErrorMsg('Nombre y código de barras son obligatorios.'); return }
    setSaving(true); setErrorMsg('')
    try {
      if (editando) {
        await editarProducto(editando.id, form)
      } else {
        await crearProductoAdmin(form)
      }
      setShowModal(false)
      await loadData()
    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── toggle activo ─────────────────────────────────────────────
  const handleToggle = async (p) => {
    const accion = p.activo ? 'desactivar' : 'activar'
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} "${p.nombre}"?`)) return
    try {
      await toggleProducto(p.id, !p.activo)
      await loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  // ── descargar plantilla de importación ────────────────────────
  const handleDescargarPlantilla = () => {
    const filas = [
      { nombre: 'Producto ejemplo',      variante: '500ml', codigo_barras: '7790001234567', sku: 'EJ-001' },
      { nombre: 'Otro producto ejemplo', variante: '1L',    codigo_barras: '7790001234574', sku: '' },
    ]
    const ws = xlsxUtils.json_to_sheet(filas, {
      header: ['nombre', 'variante', 'codigo_barras', 'sku'],
    })
    ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 14 }]
    const wb = xlsxUtils.book_new()
    xlsxUtils.book_append_sheet(wb, ws, 'Productos')
    xlsxWriteFile(wb, 'plantilla_productos.xlsx')
  }

  // ── importar Excel / CSV ──────────────────────────────────────
  const handleImport = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true); setImportMsg('')
    try {
      const buffer = await file.arrayBuffer()
      const wb = xlsxRead(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = xlsxUtils.sheet_to_json(ws, { defval: '' })
      const n = await importarProductosCSV(rows)
      setImportMsg(`✓ ${n} producto${n !== 1 ? 's' : ''} importados correctamente.`)
      await loadData()
    } catch (err) {
      setImportMsg(`✕ Error: ${err.message}`)
    } finally {
      setImporting(false)
      fileRef.current.value = ''
    }
  }

  const activos   = productos.filter(p => p.activo).length
  const inactivos = productos.length - activos

  return (
    <div style={{ padding: '24px 20px', maxWidth: 960, margin: '0 auto' }}>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Productos</div>
          {!loading && (
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
              {activos} activos{inactivos > 0 ? ` · ${inactivos} inactivos` : ''} · {productos.length} total
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {apiHabilitada && (
            <button
              onClick={handleSincronizarApi}
              disabled={syncing}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: syncing ? '#F3F4F6' : '#fff', border: `2px solid ${G}`, color: G, fontWeight: 700, fontSize: 13, cursor: syncing ? 'not-allowed' : 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}
              title="Sincroniza sucursales, depósitos y productos desde la API externa"
            >
              {syncing
                ? <><Spinner /> Sincronizando...</>
                : <><svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> Sincronizar API</>
              }
            </button>
          )}
          <input type="file" ref={fileRef} accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImport} />
          <button
            onClick={handleDescargarPlantilla}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#fff', border: '2px solid #D1D5DB', color: '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}
            title="Descargar plantilla de Excel con las columnas requeridas"
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1={12} y1={15} x2={12} y2={3}/></svg>
            Plantilla
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: importing ? '#F3F4F6' : '#fff', border: `2px solid ${B}`, color: B, fontWeight: 700, fontSize: 13, cursor: importing ? 'not-allowed' : 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}
          >
            {importing
              ? <><Spinner /> Procesando...</>
              : <><svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1={12} y1={3} x2={12} y2={15}/></svg> Importar Excel</>
            }
          </button>
          <button
            onClick={abrirCrear}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: B, border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"><line x1={12} y1={5} x2={12} y2={19}/><line x1={5} y1={12} x2={19} y2={12}/></svg>
            Nuevo
          </button>
        </div>
      </div>

      {/* mensaje sync API */}
      {syncMsg && (
        <div style={{
          background: syncMsg.startsWith('✓') ? GL : syncMsg.startsWith('✕') ? '#FEF2F2' : BL,
          border:     `1px solid ${syncMsg.startsWith('✓') ? '#6EE7B7' : syncMsg.startsWith('✕') ? '#FECACA' : `${B}33`}`,
          padding: '10px 14px', fontSize: 13,
          color:      syncMsg.startsWith('✓') ? '#065F46' : syncMsg.startsWith('✕') ? '#DC2626' : '#1E40AF',
          marginBottom: 16, fontWeight: 500
        }}>
          {syncMsg}
        </div>
      )}

      {/* mensaje importación */}
      {importMsg && (
        <div style={{
          background: importMsg.startsWith('✓') ? GL : '#FEF2F2',
          border: `1px solid ${importMsg.startsWith('✓') ? '#6EE7B7' : '#FECACA'}`,
          padding: '10px 14px', fontSize: 13,
          color: importMsg.startsWith('✓') ? '#065F46' : '#DC2626',
          marginBottom: 16, fontWeight: 500
        }}>
          {importMsg}
        </div>
      )}

      {/* formato excel */}
      <div style={{ background: BL, border: `1px solid ${B}33`, padding: '10px 14px', fontSize: 12, color: '#374151', marginBottom: 16 }}>
        <strong style={{ color: B }}>Formato Excel:</strong> columnas →{' '}
        <span style={{ fontFamily: "'DM Mono',monospace" }}>nombre | variante | codigo_barras | sku</span>
        {' '}(primera fila = encabezado). El código de barras se usa como clave única (upsert). El SKU es opcional.{' '}
        <button
          onClick={handleDescargarPlantilla}
          style={{ background: 'none', border: 'none', color: B, fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 12, textDecoration: 'underline' }}
        >
          Descargar plantilla
        </button>
      </div>

      {/* búsqueda + filtro */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><circle cx={11} cy={11} r={7}/><path d="M21 21l-4.35-4.35"/></svg>
          </span>
          <input
            type="text" placeholder="Buscar por nombre, variante, SKU o código..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} autoComplete="off"
            style={{ width: '100%', height: 42, border: '2px solid #E5E7EB', paddingLeft: 38, paddingRight: 14, fontSize: 14, color: '#111827', background: '#fff' }}
            onFocus={e => e.target.style.borderColor = B}
            onBlur={e => e.target.style.borderColor = '#E5E7EB'}
          />
        </div>
        {inactivos > 0 && (
          <button
            onClick={() => setMostrarInactivos(v => !v)}
            style={{ padding: '0 16px', height: 42, border: `2px solid ${mostrarInactivos ? B : '#E5E7EB'}`, background: mostrarInactivos ? BL : '#fff', color: mostrarInactivos ? B : '#6B7280', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {mostrarInactivos ? '✓ ' : ''}Ver inactivos
          </button>
        )}
      </div>

      {/* tabla */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px 120px 80px', padding: '10px 16px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
            {['Cód. Barras', 'Producto / Variante', 'SKU', 'Estado', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', textAlign: i === 4 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>
          <div style={{ overflowX: 'auto' }}>
            {filtrados.length > 0
              ? filtrados.map((p, i) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '140px 1fr 120px 120px 80px',
                      padding: '11px 16px',
                      borderBottom: i < filtrados.length - 1 ? '1px solid #F3F4F6' : 'none',
                      alignItems: 'center',
                      background: !p.activo ? '#FAFAFA' : (i % 2 === 0 ? '#fff' : '#FAFAFA'),
                      opacity: p.activo ? 1 : 0.55,
                    }}
                  >
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: B, fontWeight: 600, background: BL, border: '1px solid #BFDBFE', padding: '2px 6px', display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.codigo_barras}</div>
                    <div style={{ paddingLeft: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{p.nombre}</div>
                      {p.variante && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{p.variante}</div>}
                    </div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#6B7280' }}>{p.sku || '—'}</div>
                    <div>
                      <span style={{ background: p.activo ? GL : '#F3F4F6', color: p.activo ? '#065F46' : '#6B7280', padding: '3px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                      <button
                        onClick={() => abrirEditar(p)}
                        title="Editar"
                        style={{ width: 30, height: 30, background: BL, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: B }}
                      >
                        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button
                        onClick={() => handleToggle(p)}
                        title={p.activo ? 'Desactivar' : 'Activar'}
                        style={{ width: 30, height: 30, background: p.activo ? '#FEF2F2' : GL, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.activo ? '#DC2626' : G }}
                      >
                        {p.activo
                          ? <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><circle cx={12} cy={12} r={10}/><line x1={4.93} y1={4.93} x2={19.07} y2={19.07}/></svg>
                          : <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><path d="M20 6L9 17l-5-5"/></svg>
                        }
                      </button>
                    </div>
                  </div>
                ))
              : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
                  {busqueda ? `Sin resultados para "${busqueda}"` : 'No hay productos. Importá un Excel o crea uno manualmente.'}
                </div>
              )
            }
          </div>
        </div>
      )}

      {/* modal crear / editar */}
      {showModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div className="sup" style={{ background: '#fff', width: '100%', maxWidth: 460, borderTop: `3px solid ${B}` }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>{editando ? 'Editar producto' : 'Nuevo producto'}</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#6B7280' }}>✕</button>
            </div>
            <form onSubmit={handleGuardar} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Nombre *',           key: 'nombre',        ph: 'Ej: Remera manga corta' },
                { label: 'Variante',           key: 'variante',      ph: 'Ej: Azul / Talle M' },
                { label: 'Código de barras *', key: 'codigo_barras', ph: 'Ej: 7790001234567' },
                { label: 'SKU',                key: 'sku',           ph: 'Ej: PROD-001 (opcional)' },
              ].map(({ label, key, ph }) => (
                <div key={key}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>{label}</div>
                  <input
                    type="text" placeholder={ph} value={form[key]} autoComplete="off"
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
                  {saving ? <><Spinner /> Guardando...</> : `✓ ${editando ? 'Guardar cambios' : 'Crear producto'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
