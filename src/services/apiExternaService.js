import { supabase } from './supabase'

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-externa`

function _getToken() {
  const key = `sb-${import.meta.env.VITE_SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`
  try { return JSON.parse(localStorage.getItem(key) || '{}').access_token || null } catch { return null }
}

async function _callReporte(reporte) {
  const token = _getToken()
  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reporte }),
  })
  const json = await res.json()
  if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
  return Array.isArray(json.data) ? json.data : []
}

const toBool = v => v === true || v === 1 || v === '1' || v === 'true'

async function _getClienteId() {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase.from('perfiles').select('cliente_id').eq('id', user.id).maybeSingle()
  if (!perfil?.cliente_id) throw new Error('Sin cliente asignado')
  return perfil.cliente_id
}

// ── Sucursales ───────────────────────────────────────────────
export async function sincronizarSucursales() {
  const cliente_id = await _getClienteId()
  const filas = await _callReporte('KONTAR_SUCURSALES')
  const rows = filas.map(r => ({
    cliente_id,
    id_externo: String(r.ID),
    nombre:     String(r.Nombre || '').trim(),
    activo:     toBool(r.Activo),
  })).filter(r => r.id_externo && r.nombre)

  if (rows.length === 0) return { total: 0 }

  const { error } = await supabase.from('sucursales').upsert(rows, { onConflict: 'cliente_id,id_externo' })
  if (error) throw new Error(error.message)
  return { total: rows.length }
}

// ── Depósitos ────────────────────────────────────────────────
export async function sincronizarDepositos() {
  const cliente_id = await _getClienteId()
  const filas = await _callReporte('KONTAR_DEPOSITOS')

  // Mapa de id_externo → id local de sucursales para resolver la FK
  const { data: sucs } = await supabase
    .from('sucursales')
    .select('id, id_externo')
    .eq('cliente_id', cliente_id)
    .not('id_externo', 'is', null)
  const sucMap = new Map((sucs || []).map(s => [String(s.id_externo), s.id]))

  let sinSucursal = 0
  const rows = filas
    .map(r => {
      const sucExt = String(r.IDSucursal ?? '')
      const sucursal_id = sucMap.get(sucExt)
      if (!sucursal_id) { sinSucursal++; return null }
      return {
        cliente_id,
        id_externo:  String(r.ID),
        nombre:      String(r.Nombre || '').trim(),
        activo:      toBool(r.Activo),
        sucursal_id,
      }
    })
    .filter(r => r && r.id_externo && r.nombre)

  if (rows.length === 0) return { total: 0, sinSucursal }

  const { error } = await supabase.from('depositos').upsert(rows, { onConflict: 'cliente_id,id_externo' })
  if (error) throw new Error(error.message)
  return { total: rows.length, sinSucursal }
}

// ── Productos ────────────────────────────────────────────────
const CHUNK = 500

export async function sincronizarProductos() {
  const cliente_id = await _getClienteId()
  const filas = await _callReporte('KONTAR_PRODUCTOS')

  const rows = filas.map(r => ({
    cliente_id,
    id_externo:    String(r.ID),
    codigo_barras: String(r['Código de barras'] || '').trim(),
    nombre:        String(r.Nombre || '').trim(),
    sku:           String(r.SKU || '').trim() || null,
    variante:      String(r.Variante || '').trim(),
    activo:        toBool(r.Activo),
  })).filter(r => r.id_externo && r.codigo_barras && r.nombre)

  let total = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const lote = rows.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('productos')
      .upsert(lote, { onConflict: 'cliente_id,id_externo' })
    if (error) throw new Error(`Lote ${i / CHUNK + 1}: ${error.message}`)
    total += lote.length
  }
  return { total, descartadas: filas.length - rows.length }
}

// ── Stock teórico ────────────────────────────────────────────
// Devuelve el stock externo crudo: [{IDDeposito, IDProducto, Existencia}]
export async function obtenerStockExterno() {
  return await _callReporte('KONTAR_STOCK')
}

/**
 * Carga el stock teórico de un inventario desde la API externa.
 * Por defecto usa el deposito_id del inventario; opts.depositoId permite comparar
 * contra otro depósito (mismo cliente). Hace UPSERT en inventario_stock_teorico.
 */
export async function cargarStockTeoricoDesdeAPI(inventario_id, opts = {}) {
  const cliente_id = await _getClienteId()
  const { depositoId: depositoIdOverride } = opts

  let deposito_id = depositoIdOverride
  if (!deposito_id) {
    const { data: inv, error: invErr } = await supabase
      .from('inventarios')
      .select('id, deposito_id')
      .eq('id', inventario_id)
      .maybeSingle()
    if (invErr) throw new Error(invErr.message)
    if (!inv) throw new Error('Inventario no encontrado')
    if (!inv.deposito_id) throw new Error('Este inventario no tiene depósito asignado. Elegí un depósito para comparar.')
    deposito_id = inv.deposito_id
  }

  // id_externo del depósito (acotado al cliente para que el override no cruce tenants)
  const { data: dep } = await supabase
    .from('depositos')
    .select('id, id_externo, nombre')
    .eq('id', deposito_id)
    .eq('cliente_id', cliente_id)
    .maybeSingle()
  if (!dep) throw new Error('Depósito no encontrado o no pertenece al cliente.')
  if (!dep.id_externo) throw new Error('El depósito elegido no está vinculado a ningún ID externo. Sincronizá depósitos desde la API primero.')

  // Traer stock crudo de la API y filtrar por depósito
  const stockCrudo = await obtenerStockExterno()
  const idDep = String(dep.id_externo)
  const filasDeposito = stockCrudo.filter(r => String(r.IDDeposito) === idDep)
  if (filasDeposito.length === 0) {
    return { total: 0, sinDeposito: 0, sinProducto: 0, mensaje: 'La API devolvió 0 filas para este depósito.' }
  }

  // Mapa id_externo → producto_id local
  const PAGE = 1000
  let prods = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('productos')
      .select('id, id_externo')
      .eq('cliente_id', cliente_id)
      .not('id_externo', 'is', null)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    prods = prods.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  const prodMap = new Map(prods.map(p => [String(p.id_externo), p.id]))

  let sinProducto = 0
  const rows = filasDeposito
    .map(r => {
      const producto_id = prodMap.get(String(r.IDProducto))
      if (!producto_id) { sinProducto++; return null }
      return {
        cliente_id,
        inventario_id,
        producto_id,
        cantidad: Number(r.Existencia) || 0,
        fuente: 'api',
      }
    })
    .filter(Boolean)

  // Limpiar lo previo y upsert
  await supabase.from('inventario_stock_teorico').delete().eq('inventario_id', inventario_id)

  const CHUNK = 500
  let total = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const lote = rows.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('inventario_stock_teorico')
      .upsert(lote, { onConflict: 'inventario_id,producto_id' })
    if (error) throw new Error(`Lote ${i / CHUNK + 1}: ${error.message}`)
    total += lote.length
  }

  return { total, sinProducto, deposito: dep.id_externo, depositoNombre: dep.nombre, depositoId: dep.id }
}

// ── Ajustes de stock al ERP (KONTAR_AJUSTE) ─────────────────

/**
 * Llama al Edge Function con `reporte` + payload arbitrario.
 * Devuelve la respuesta completa (incluido `data`).
 */
async function _callConPayload(payload) {
  const token = _getToken()
  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  return { httpOk: res.ok, status: res.status, json }
}

/**
 * Devuelve un Set con los producto_id ya enviados al ERP para este inventario.
 */
export async function getAjustesEnviadosIds(inventario_id) {
  const { data, error } = await supabase
    .from('ajustes_enviados')
    .select('producto_id')
    .eq('inventario_id', inventario_id)
  if (error) throw new Error(error.message)
  return new Set((data || []).map(r => Number(r.producto_id)))
}

/**
 * Detalle completo del historial de ajustes enviados, con info del producto.
 * Más recientes primero.
 */
export async function getAjustesEnviadosDetalle(inventario_id) {
  const { data, error } = await supabase
    .from('ajustes_enviados')
    .select('producto_id, conteo, sistema, mensaje, ok, sent_at, producto:producto_id(nombre, variante, sku, codigo_barras)')
    .eq('inventario_id', inventario_id)
    .order('sent_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

/**
 * Envía a `KONTAR_AJUSTE` todos los productos del inventario con diferencia o pendientes,
 * saltando los ya enviados. Por cada éxito inserta en `ajustes_enviados` para que no se
 * reenvíe nunca más. Por cada error sigue con el siguiente (sin marcar como enviado).
 *
 * @param {object} ctx
 *   - inventario:     {id, estado, fecha_inicio, deposito_id}
 *   - diferencias:    array de filas de getDiferencias({filas, resumen})
 *   - onProgress?:    fn({index, total, exitos, errores, omitidos, ultimoProducto, ultimoMensaje})
 *
 * @returns {Promise<{exitos:number, errores:number, omitidos:number, total:number}>}
 */
export async function enviarAjustesInventario({ inventario, diferencias, onProgress }) {
  if (!inventario || inventario.estado !== 'cerrado') {
    throw new Error('Sólo se pueden enviar ajustes de inventarios cerrados.')
  }
  const cliente_id = await _getClienteId()

  // Resolver IDs externos de sucursal y depósito
  const { data: dep, error: depErr } = await supabase
    .from('depositos')
    .select('id, id_externo, sucursal_id')
    .eq('id', inventario.deposito_id)
    .eq('cliente_id', cliente_id)
    .maybeSingle()
  if (depErr) throw new Error(depErr.message)
  if (!dep)            throw new Error('Depósito del inventario no encontrado para este cliente.')
  if (!dep.id_externo) throw new Error('El depósito no tiene id_externo cargado. Sincronizá depósitos primero.')

  const { data: suc, error: sucErr } = await supabase
    .from('sucursales')
    .select('id, id_externo')
    .eq('id', dep.sucursal_id)
    .maybeSingle()
  if (sucErr) throw new Error(sucErr.message)
  if (!suc)            throw new Error('Sucursal del depósito no encontrada.')
  if (!suc.id_externo) throw new Error('La sucursal no tiene id_externo cargado. Sincronizá sucursales primero.')

  // Filtrar filas a enviar: diferencia != 0 OR pendiente
  const todas = (diferencias?.filas || []).filter(f =>
    (Number(f.diferencia) || 0) !== 0 || f.estado === 'pendiente'
  )

  // Excluir ya enviados
  const yaEnviados = await getAjustesEnviadosIds(inventario.id)
  const pendientes = todas.filter(f => !yaEnviados.has(Number(f.producto_id)))

  // Fecha: usar la del inicio del inventario o hoy
  const fecha = (inventario.fecha_inicio || new Date().toISOString().slice(0, 10)).slice(0, 10)

  let exitos = 0, errores = 0, omitidos = 0
  const total = pendientes.length

  // userId para el campo enviado_por
  const { data: { user } } = await supabase.auth.getUser()

  for (let i = 0; i < pendientes.length; i++) {
    const f = pendientes[i]
    const conteo  = Number(f.contado) || 0
    const sistema = Number(f.teorico) || 0

    let ultimoMensaje = ''
    let ok = false

    if (!f.id_externo) {
      omitidos++
      ultimoMensaje = `Producto sin id_externo`
    } else if (!f.codigo_barras) {
      omitidos++
      ultimoMensaje = `Producto sin código de barras`
    } else {
      try {
        const { httpOk, json } = await _callConPayload({
          reporte:     'KONTAR_AJUSTE',
          fecha,
          sucursal:    Number(suc.id_externo),
          deposito:    Number(dep.id_externo),
          codigo:      String(f.id_externo),
          codigoBarra: String(f.codigo_barras),
          conteo,
          sistema,
        })
        const row = Array.isArray(json?.data) ? json.data[0] : null
        const procesado = row?.Procesado === true || row?.Procesado === 1
        ultimoMensaje = row?.Mensaje || json?.error || (httpOk ? 'OK' : `HTTP ${json?.status || ''}`)
        ok = httpOk && procesado

        if (ok) {
          // Insertar en ajustes_enviados (idempotente: si ya existe, falla — pero no debería pasar)
          const { error: insErr } = await supabase.from('ajustes_enviados').insert({
            inventario_id: inventario.id,
            producto_id:   f.producto_id,
            cliente_id,
            conteo,
            sistema,
            mensaje:       ultimoMensaje,
            ok:            true,
            enviado_por:   user?.id || null,
          })
          if (insErr) {
            // Si el INSERT falla, no contamos como éxito (se reintentará)
            errores++
            ok = false
            ultimoMensaje = `Enviado al ERP pero falló registro local: ${insErr.message}`
          } else {
            exitos++
          }
        } else {
          errores++
        }
      } catch (e) {
        errores++
        ultimoMensaje = e?.message || 'Error de red'
      }
    }

    onProgress?.({
      index: i + 1,
      total,
      exitos,
      errores,
      omitidos,
      ultimoProducto: f.nombre,
      ultimoMensaje,
      ok,
    })
  }

  return { exitos, errores, omitidos, total }
}

/**
 * Variante demo de enviarAjustesInventario: NO llama al Edge Function ni inserta
 * en ajustes_enviados. Simula el envío con un delay corto por producto y siempre
 * "procesa" exitosamente. Útil para validar la UI sin tener la tabla creada ni el SP listo.
 */
export async function enviarAjustesInventarioDemo({ inventario, diferencias, onProgress }) {
  if (!inventario) throw new Error('Falta inventario')

  const todas = (diferencias?.filas || []).filter(f =>
    (Number(f.diferencia) || 0) !== 0 || f.estado === 'pendiente'
  )

  // En demo no excluimos los ya enviados (no consultamos la DB)
  const pendientes = todas
  let exitos = 0, errores = 0, omitidos = 0
  const total = pendientes.length

  for (let i = 0; i < pendientes.length; i++) {
    const f = pendientes[i]
    // Simular un retardo de red para que se vea la barra de progreso
    await new Promise(r => setTimeout(r, 120))

    let ok = false
    let mensaje = ''

    if (!f.id_externo) {
      omitidos++
      mensaje = 'DEMO: producto sin id_externo (no se enviaría)'
    } else if (!f.codigo_barras) {
      omitidos++
      mensaje = 'DEMO: producto sin código de barras (no se enviaría)'
    } else {
      // Simular: 1 de cada 10 falla, el resto pasa
      if ((i + 1) % 10 === 0) {
        errores++
        mensaje = `DEMO: error simulado (cant=${f.contado}, teorico=${f.teorico})`
      } else {
        exitos++
        ok = true
        mensaje = `DEMO ok · ajuste ${Number(f.contado) - Number(f.teorico)}`
      }
    }

    onProgress?.({
      index: i + 1,
      total,
      exitos,
      errores,
      omitidos,
      ultimoProducto: f.nombre,
      ultimoMensaje: mensaje,
      ok,
    })
  }

  return { exitos, errores, omitidos, total }
}

// ── Sincronización completa (orden importa) ──────────────────
export async function sincronizarTodo(onProgress) {
  const r = { sucursales: 0, depositos: 0, productos: 0, sinSucursal: 0, descartadas: 0 }
  onProgress?.('Sincronizando sucursales...')
  r.sucursales = (await sincronizarSucursales()).total

  onProgress?.('Sincronizando depósitos...')
  const dep = await sincronizarDepositos()
  r.depositos = dep.total
  r.sinSucursal = dep.sinSucursal

  onProgress?.('Sincronizando productos...')
  const pr = await sincronizarProductos()
  r.productos = pr.total
  r.descartadas = pr.descartadas

  return r
}
