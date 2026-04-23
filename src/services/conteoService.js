import { supabase } from './supabase'

/**
 * Inventario activo del cliente autenticado (el más reciente con estado 'abierto')
 */
export async function getInventarioActivo(deposito_id = null) {
  let q = supabase
    .from('inventarios')
    .select('*')
    .eq('estado', 'abierto')
    .order('created_at', { ascending: false })
    .limit(1)
  if (deposito_id) q = q.eq('deposito_id', deposito_id)
  const { data } = await q.maybeSingle()
  return data || null
}

/**
 * Total de productos activos del cliente (para mostrar en el inventario)
 */
export async function getTotalProductos() {
  const { count } = await supabase
    .from('productos')
    .select('id', { count: 'exact', head: true })
    .eq('activo', true)
  return count || 0
}

/**
 * Zonas del inventario, con conteo de productos ya registrados
 */
export async function getZonas(inventario_id, deposito_id = null) {
  let q = supabase.from('zonas').select('*').eq('inventario_id', inventario_id).order('created_at')
  if (deposito_id) q = q.eq('deposito_id', deposito_id)
  const { data: zonas } = await q

  if (!zonas?.length) return []

  // Contar cuántos productos distintos hay en cada zona
  const { data: counts } = await supabase
    .from('conteos')
    .select('zona_id')
    .eq('inventario_id', inventario_id)

  const countMap = {}
  for (const c of counts || []) {
    countMap[c.zona_id] = (countMap[c.zona_id] || 0) + 1
  }

  return zonas.map(z => ({
    ...z,
    productos_contados: countMap[z.id] || 0,
    total_productos: 0, // no hay total fijo por zona
  }))
}

/**
 * Crear zona nueva
 */
export async function crearZona(inventario_id, nombre, descripcion, deposito_id = null) {
  const { data, error } = await supabase
    .from('zonas')
    .insert({ inventario_id, nombre: nombre.trim(), descripcion: descripcion?.trim() || '', deposito_id: deposito_id || null })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return { ...data, productos_contados: 0, total_productos: 0 }
}

/**
 * Marcar zona como finalizada
 */
export async function finalizarZona(zona_id) {
  const { error } = await supabase
    .from('zonas')
    .update({ finalizada: true })
    .eq('id', zona_id)
  if (error) throw new Error(error.message)
}

/**
 * Marcar inventario como cerrado
 */
export async function finalizarInventario(inventario_id) {
  const { error } = await supabase
    .from('inventarios')
    .update({ estado: 'cerrado' })
    .eq('id', inventario_id)
  if (error) throw new Error(error.message)
}

/**
 * Conteos de una zona con datos de producto (más reciente primero)
 */
export async function getConteosPorZona(zona_id) {
  const { data } = await supabase
    .from('conteos')
    .select('id, cantidad, updated_at, producto:producto_id(id, nombre, variante, sku)')
    .eq('zona_id', zona_id)
    .order('updated_at', { ascending: false })

  return (data || []).map(c => ({
    id:          c.producto.id, // usamos producto_id como id del item en el estado local
    conteo_id:   c.id,
    producto_id: c.producto.id,
    nombre:      c.producto.nombre,
    variante:    c.producto.variante,
    sku:         c.producto.sku,
    cantidad:    c.cantidad,
    ts:          new Date(c.updated_at),
  }))
}

/**
 * Upsert de un conteo (uno por producto por zona)
 */
export async function upsertConteo({ zona_id, inventario_id, producto_id, usuario_id, cantidad }) {
  const { error } = await supabase
    .from('conteos')
    .upsert(
      { zona_id, inventario_id, producto_id, usuario_id, cantidad, updated_at: new Date().toISOString() },
      { onConflict: 'zona_id,producto_id' }
    )
  if (error) throw new Error(error.message)
}

/**
 * Elimina el conteo de un producto en una zona (usado por "Deshacer" cuando
 * la cantidad revertida queda en 0).
 */
export async function deleteConteo({ zona_id, producto_id }) {
  const { error } = await supabase
    .from('conteos')
    .delete()
    .eq('zona_id', zona_id)
    .eq('producto_id', producto_id)
  if (error) throw new Error(error.message)
}

/**
 * Formato de fecha YYYY-MM-DD → DD/MM/YYYY
 */
export function fmtFecha(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
