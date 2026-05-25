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
        .select('cantidad, updated_at, zona:zona_id(nombre), usuario:perfiles!conteos_usuario_perfil_fkey(nombre)')
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

export async function crearInventario({ nombre, sucursal, deposito, deposito_id, responsable, fecha_inicio, fecha_limite }) {
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
    .insert({ nombre, sucursal, deposito, deposito_id: deposito_id || null, responsable, cliente_id: perfil.cliente_id, fecha_inicio: toISO(fecha_inicio), fecha_limite: toISO(fecha_limite) })
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

/**
 * Estadísticas agregadas de un inventario: cuántos conteos, productos únicos y unidades totales.
 * Pagina las filas de conteos del inventario para no truncar al límite de PostgREST.
 */
export async function getInventarioStats(inventario_id) {
  const PAGE = 1000
  let all = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('conteos')
      .select('producto_id, cantidad')
      .eq('inventario_id', inventario_id)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return {
    conteos:   all.length,
    productos: new Set(all.map(c => c.producto_id)).size,
    unidades:  all.reduce((s, c) => s + (Number(c.cantidad) || 0), 0),
  }
}

export async function getInventarioDetalle(inventario_id) {
  // Pagina las filas de conteos del inventario para que no se trunque al
  // límite de 1000 de PostgREST (si no, zonas creadas tarde quedan en 0/0).
  const PAGE = 1000
  async function fetchAllConteos() {
    const all = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('conteos')
        .select('zona_id, producto_id, cantidad')
        .eq('inventario_id', inventario_id)
        .range(from, from + PAGE - 1)
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) break
      all.push(...data)
      if (data.length < PAGE) break
      from += PAGE
    }
    return all
  }

  const [zonasRes, conteoRows, actRes] = await Promise.all([
    supabase
      .from('zonas')
      .select('id, nombre, descripcion, finalizada, created_at')
      .eq('inventario_id', inventario_id)
      .order('created_at'),
    fetchAllConteos(),
    supabase
      .from('conteos')
      .select('cantidad, updated_at, producto:producto_id(nombre, variante, sku, codigo_barras), zona:zona_id(nombre), usuario:perfiles!conteos_usuario_perfil_fkey(nombre)')
      .eq('inventario_id', inventario_id)
      .order('updated_at', { ascending: false })
      .limit(30),
  ])

  const zonas = zonasRes.data || []

  // Agregar por zona: conteos, productos únicos, unidades
  const zonaMap = {}
  for (const c of conteoRows) {
    let m = zonaMap[c.zona_id]
    if (!m) { m = { conteos: 0, productos: new Set(), unidades: 0 }; zonaMap[c.zona_id] = m }
    m.conteos++
    m.productos.add(c.producto_id)
    m.unidades += Number(c.cantidad) || 0
  }

  return {
    zonas: zonas.map(z => ({
      ...z,
      conteos:   zonaMap[z.id]?.conteos || 0,
      productos: zonaMap[z.id]?.productos.size || 0,
      unidades:  zonaMap[z.id]?.unidades || 0,
    })),
    actividad: actRes.data || [],
    totalConteos:   conteoRows.length,
    totalProductos: new Set(conteoRows.map(c => c.producto_id)).size,
    totalUnidades:  conteoRows.reduce((s, c) => s + (Number(c.cantidad) || 0), 0),
  }
}

export async function getConteosInventario(inventario_id) {
  const PAGE = 1000
  let all = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('conteos')
      .select('cantidad, updated_at, producto:producto_id(id, sku, nombre, variante, codigo_barras), zona:zona_id(id, nombre), usuario:perfiles!conteos_usuario_perfil_fkey(nombre)')
      .eq('inventario_id', inventario_id)
      .order('updated_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) { console.error('getConteosInventario', error); throw new Error(error.message) }
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

/**
 * Devuelve las diferencias de un inventario:
 * teórico (de inventario_stock_teorico) vs contado (suma de conteos.cantidad por producto).
 * Resuelve los 3 casos: ambos, solo teórico (faltante total), solo contado (no esperado).
 */
export async function getDiferencias(inventario_id) {
  const PAGE = 1000

  // ── Teórico (paginado) ──
  let teoricoRows = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('inventario_stock_teorico')
      .select('producto_id, cantidad, costo_unitario, producto:producto_id(id, nombre, variante, sku, codigo_barras)')
      .eq('inventario_id', inventario_id)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    teoricoRows = teoricoRows.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }

  // ── Conteos (paginado) ──
  let conteoRows = []
  from = 0
  while (true) {
    const { data, error } = await supabase
      .from('conteos')
      .select('producto_id, cantidad, producto:producto_id(id, nombre, variante, sku, codigo_barras)')
      .eq('inventario_id', inventario_id)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    conteoRows = conteoRows.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }

  // ── Mergear: clave producto_id ──
  const map = new Map()
  for (const t of teoricoRows) {
    map.set(t.producto_id, {
      producto_id:   t.producto_id,
      nombre:        t.producto?.nombre || '—',
      variante:      t.producto?.variante || '',
      sku:           t.producto?.sku || '',
      codigo_barras: t.producto?.codigo_barras || '',
      teorico:       Number(t.cantidad) || 0,
      contado:       0,
      costo:         t.costo_unitario ? Number(t.costo_unitario) : null,
    })
  }
  for (const c of conteoRows) {
    const ex = map.get(c.producto_id)
    if (ex) {
      ex.contado += Number(c.cantidad) || 0
    } else {
      map.set(c.producto_id, {
        producto_id:   c.producto_id,
        nombre:        c.producto?.nombre || '—',
        variante:      c.producto?.variante || '',
        sku:           c.producto?.sku || '',
        codigo_barras: c.producto?.codigo_barras || '',
        teorico:       0,
        contado:       Number(c.cantidad) || 0,
        costo:         null,
      })
    }
  }

  const filas = Array.from(map.values()).map(r => {
    const dif = r.contado - r.teorico
    let estado
    if (r.teorico > 0 && r.contado === 0) estado = 'pendiente'   // aún no escaneado
    else if (dif === 0)                   estado = 'ok'
    else if (dif > 0 && r.teorico === 0)  estado = 'no-esperado'
    else if (dif > 0)                     estado = 'sobrante'
    else                                  estado = 'faltante'    // contado < teorico (faltante real)
    return {
      ...r,
      diferencia: dif,
      pct:   r.teorico > 0 ? (dif / r.teorico) * 100 : null,
      valor: r.costo != null ? dif * r.costo : null,
      estado,
    }
  })

  return {
    filas,
    resumen: {
      total:        filas.length,
      ok:           filas.filter(f => f.estado === 'ok').length,
      pendientes:   filas.filter(f => f.estado === 'pendiente').length,
      faltantes:    filas.filter(f => f.estado === 'faltante').length,
      sobrantes:    filas.filter(f => f.estado === 'sobrante').length,
      noEsperados:  filas.filter(f => f.estado === 'no-esperado').length,
      valorNeto:    filas.reduce((s, f) => s + (f.valor || 0), 0),
    },
  }
}

export async function getStockTeoricoStatus(inventario_id) {
  const { count } = await supabase
    .from('inventario_stock_teorico')
    .select('id', { count: 'exact', head: true })
    .eq('inventario_id', inventario_id)
  return { cargado: (count || 0) > 0, total: count || 0 }
}

export async function getZonaDetalle(zona_id) {
  const { data } = await supabase
    .from('conteos')
    .select('cantidad, updated_at, producto:producto_id(id, sku, nombre, variante, codigo_barras), usuario:perfiles!conteos_usuario_perfil_fkey(nombre)')
    .eq('zona_id', zona_id)
    .order('updated_at', { ascending: false })
  return data || []
}

// ── Productos ────────────────────────────────────────────────
export async function getProductosAdmin() {
  const PAGE = 1000
  let all = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('productos')
      .select('id, sku, nombre, variante, codigo_barras, activo, created_at, id_externo')
      .order('nombre')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

export async function crearProductoAdmin({ sku, nombre, variante, codigo_barras }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase.from('perfiles').select('cliente_id').eq('id', user.id).maybeSingle()
  if (!perfil) throw new Error('No se encontró el perfil del usuario.')
  const cb = String(codigo_barras || '').trim()
  if (!cb) throw new Error('El código de barras es obligatorio.')
  const { data, error } = await supabase
    .from('productos')
    .insert({
      sku:           sku ? String(sku).trim() : null,
      nombre,
      variante:      variante || '',
      codigo_barras: cb,
      cliente_id:    perfil.cliente_id,
    })
    .select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function editarProducto(id, { sku, nombre, variante, codigo_barras }) {
  const cb = String(codigo_barras || '').trim()
  if (!cb) throw new Error('El código de barras es obligatorio.')
  const { data, error } = await supabase
    .from('productos')
    .update({
      sku:           sku ? String(sku).trim() : null,
      nombre,
      variante:      variante || '',
      codigo_barras: cb,
    })
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
    .map(r => {
      const skuRaw = String(r.sku || r.SKU || '').trim()
      return {
        cliente_id:    perfil.cliente_id,
        sku:           skuRaw || null,
        nombre:        String(r.nombre || r.Nombre || '').trim(),
        variante:      String(r.variante || r.Variante || '').trim(),
        codigo_barras: String(r.codigo_barras || r['Código de Barras'] || r.codigo || '').trim(),
        activo:        true,
      }
    })
    .filter(r => r.codigo_barras && r.nombre)

  if (!items.length) throw new Error('No se encontraron filas válidas (requiere columnas nombre y codigo_barras).')

  const { error } = await supabase
    .from('productos')
    .upsert(items, { onConflict: 'cliente_id,codigo_barras' })
  if (error) throw new Error(error.message)
  return items.length
}

// ── Usuarios admin (para selector de responsable) ───────────
export async function getAdmins() {
  const { data } = await supabase
    .from('perfiles')
    .select('id, nombre')
    .eq('rol', 'admin')
    .order('nombre')
  return data || []
}

// ── Sucursales ───────────────────────────────────────────────
export async function getSucursales(soloActivas = true) {
  let q = supabase.from('sucursales').select('id, nombre, activo').order('nombre')
  if (soloActivas) q = q.eq('activo', true)
  const { data } = await q
  return data || []
}

export async function crearSucursal(nombre) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase.from('perfiles').select('cliente_id').eq('id', user.id).maybeSingle()
  if (!perfil) throw new Error('No se encontró el perfil del usuario.')
  const { data, error } = await supabase.from('sucursales').insert({ nombre, cliente_id: perfil.cliente_id }).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function editarSucursal(id, nombre) {
  const { data, error } = await supabase.from('sucursales').update({ nombre }).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function toggleSucursal(id, activo) {
  const { error } = await supabase.from('sucursales').update({ activo }).eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Depósitos ────────────────────────────────────────────────
export async function getDepositos(soloActivos = true, sucursalId = null) {
  let q = supabase.from('depositos').select('id, nombre, activo, sucursal_id, id_externo').order('nombre')
  if (soloActivos)   q = q.eq('activo', true)
  if (sucursalId)    q = q.eq('sucursal_id', sucursalId)
  const { data } = await q
  return data || []
}

export async function crearDeposito(nombre, sucursalId = null) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase.from('perfiles').select('cliente_id').eq('id', user.id).maybeSingle()
  if (!perfil) throw new Error('No se encontró el perfil del usuario.')
  const { data, error } = await supabase.from('depositos').insert({ nombre, cliente_id: perfil.cliente_id, sucursal_id: sucursalId || null }).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function editarDeposito(id, nombre) {
  const { data, error } = await supabase.from('depositos').update({ nombre }).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function toggleDeposito(id, activo) {
  const { error } = await supabase.from('depositos').update({ activo }).eq('id', id)
  if (error) throw new Error(error.message)
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

export async function cambiarPassword(userId, password) {
  return edgeFetch('PATCH', { userId, password })
}
