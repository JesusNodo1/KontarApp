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
 * Usa el deposito_id del inventario para filtrar (lookup id_externo del depósito local).
 * Hace UPSERT en inventario_stock_teorico.
 * Devuelve { total, sinDeposito, sinProducto } para reportar al usuario.
 */
export async function cargarStockTeoricoDesdeAPI(inventario_id) {
  const cliente_id = await _getClienteId()

  // Inventario y su depósito
  const { data: inv, error: invErr } = await supabase
    .from('inventarios')
    .select('id, deposito_id')
    .eq('id', inventario_id)
    .maybeSingle()
  if (invErr) throw new Error(invErr.message)
  if (!inv) throw new Error('Inventario no encontrado')
  if (!inv.deposito_id) throw new Error('Este inventario no tiene depósito asignado. No se puede comparar contra stock teórico sin saber qué depósito comparar.')

  // id_externo del depósito local
  const { data: dep } = await supabase
    .from('depositos')
    .select('id, id_externo')
    .eq('id', inv.deposito_id)
    .maybeSingle()
  if (!dep?.id_externo) throw new Error('El depósito del inventario no está vinculado a ningún ID externo. Sincronizá depósitos desde la API primero.')

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

  return { total, sinProducto, deposito: dep.id_externo }
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
