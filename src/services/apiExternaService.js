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
