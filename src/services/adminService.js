import { supabase } from './supabase'

// ── Dashboard ───────────────────────────────────────────────
export async function getDashboardData() {
  const [
    { count: totalProductos },
    { count: totalUsuarios },
    invRes,
  ] = await Promise.all([
    supabase.from('productos').select('id', { count: 'exact', head: true }).eq('activo', true),
    supabase.from('perfiles').select('id', { count: 'exact', head: true }),
    supabase.from('inventarios').select('*').eq('estado', 'abierto').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const inv = invRes.data
  let contados = 0, totalZonas = 0, zonasOk = 0, actividad = []

  if (inv) {
    const [cRes, zRes, aRes] = await Promise.all([
      supabase.from('conteos').select('id', { count: 'exact', head: true }).eq('inventario_id', inv.id),
      supabase.from('zonas').select('id, finalizada').eq('inventario_id', inv.id),
      supabase.from('conteos')
        .select('cantidad, updated_at, zona:zona_id(nombre), usuario:usuario_id(nombre)')
        .eq('inventario_id', inv.id)
        .order('updated_at', { ascending: false })
        .limit(10),
    ])
    contados   = cRes.count || 0
    totalZonas = zRes.data?.length || 0
    zonasOk    = zRes.data?.filter(z => z.finalizada).length || 0
    actividad  = aRes.data || []
  }

  return { totalProductos: totalProductos || 0, totalUsuarios: totalUsuarios || 0, inv, contados, totalZonas, zonasOk, actividad }
}

// ── Inventarios ──────────────────────────────────────────────
export async function getInventarios() {
  const { data } = await supabase
    .from('inventarios')
    .select('*')
    .order('created_at', { ascending: false })
  return data || []
}

export async function crearInventario({ nombre, sucursal, deposito, responsable, fecha_inicio, fecha_limite }) {
  const toISO = d => {
    if (!d) return null
    if (d.includes('/')) { const [dd, mm, yy] = d.split('/'); return `${yy}-${mm}-${dd}` }
    return d
  }
  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase.from('perfiles').select('cliente_id').eq('id', user.id).maybeSingle()
  if (!perfil) throw new Error('No se encontró el perfil del usuario.')
  const { data, error } = await supabase
    .from('inventarios')
    .insert({ nombre, sucursal, deposito, responsable, cliente_id: perfil.cliente_id, fecha_inicio: toISO(fecha_inicio), fecha_limite: toISO(fecha_limite) })
    .select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function cerrarInventario(id) {
  const { error } = await supabase.from('inventarios').update({ estado: 'cerrado' }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function getInventarioConteos(inventario_id) {
  const { count } = await supabase
    .from('conteos').select('id', { count: 'exact', head: true }).eq('inventario_id', inventario_id)
  return count || 0
}

export async function getInventarioDetalle(inventario_id) {
  const [zonasRes, conteosRes, actRes] = await Promise.all([
    supabase
      .from('zonas')
      .select('id, nombre, descripcion, finalizada, created_at')
      .eq('inventario_id', inventario_id)
      .order('created_at'),
    supabase
      .from('conteos')
      .select('zona_id')
      .eq('inventario_id', inventario_id),
    supabase
      .from('conteos')
      .select('cantidad, updated_at, producto:producto_id(nombre, variante, sku), zona:zona_id(nombre), usuario:usuario_id(nombre)')
      .eq('inventario_id', inventario_id)
      .order('updated_at', { ascending: false })
      .limit(30),
  ])

  const zonas = zonasRes.data || []
  const conteoRows = conteosRes.data || []

  // count conteos per zona
  const cntMap = {}
  for (const c of conteoRows) cntMap[c.zona_id] = (cntMap[c.zona_id] || 0) + 1

  return {
    zonas: zonas.map(z => ({ ...z, conteos: cntMap[z.id] || 0 })),
    actividad: actRes.data || [],
    totalConteos: conteoRows.length,
  }
}

export async function getZonaDetalle(zona_id) {
  const { data } = await supabase
    .from('conteos')
    .select('cantidad, updated_at, producto:producto_id(id, sku, nombre, variante), usuario:usuario_id(nombre)')
    .eq('zona_id', zona_id)
    .order('updated_at', { ascending: false })
  return data || []
}

// ── Productos ────────────────────────────────────────────────
export async function getProductosAdmin() {
  const { data } = await supabase
    .from('productos')
    .select('id, sku, nombre, variante, codigo_barras, activo, created_at')
    .order('nombre')
  return data || []
}

export async function crearProductoAdmin({ sku, nombre, variante, codigo_barras }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase.from('perfiles').select('cliente_id').eq('id', user.id).maybeSingle()
  if (!perfil) throw new Error('No se encontró el perfil del usuario.')
  const { data, error } = await supabase
    .from('productos')
    .insert({ sku, nombre, variante: variante || '', codigo_barras: codigo_barras || '', cliente_id: perfil.cliente_id })
    .select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function editarProducto(id, { sku, nombre, variante, codigo_barras }) {
  const { data, error } = await supabase
    .from('productos')
    .update({ sku, nombre, variante: variante || '', codigo_barras: codigo_barras || '' })
    .eq('id', id)
    .select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function toggleProducto(id, activo) {
  const { error } = await supabase.from('productos').update({ activo }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function importarProductosCSV(rows) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase.from('perfiles').select('cliente_id').eq('id', user.id).maybeSingle()
  if (!perfil) throw new Error('No se encontró el perfil del usuario.')
  const items = rows
    .map(r => ({
      cliente_id:    perfil.cliente_id,
      sku:           String(r.sku || r.SKU || '').trim(),
      nombre:        String(r.nombre || r.Nombre || '').trim(),
      variante:      String(r.variante || r.Variante || '').trim(),
      codigo_barras: String(r.codigo_barras || r['Código de Barras'] || r.codigo || '').trim(),
      activo:        true,
    }))
    .filter(r => r.sku && r.nombre)

  if (!items.length) throw new Error('No se encontraron filas válidas (requiere columnas sku y nombre).')

  const { error } = await supabase
    .from('productos')
    .upsert(items, { onConflict: 'cliente_id,sku' })
  if (error) throw new Error(error.message)
  return items.length
}

// ── Usuarios (via Edge Function con service role) ────────────
const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`

function _getToken() {
  const key = `sb-${import.meta.env.VITE_SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`
  try { return JSON.parse(localStorage.getItem(key) || '{}').access_token || null } catch { return null }
}

async function edgeFetch(method, body) {
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

export async function getUsuarios() {
  return edgeFetch('GET')
}

export async function crearUsuario({ email, password, nombre, rol }) {
  return edgeFetch('POST', { email, password, nombre, rol })
}
