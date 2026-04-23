import { supabase } from './supabase'

/**
 * Busca un producto por código de barras exacto (identificador principal).
 * Como fallback, si tuviera SKU cargado y coincide, también lo devuelve.
 */
export async function bxCod(codigo) {
  const c = codigo.trim()
  if (!c) return null
  const { data } = await supabase
    .from('productos')
    .select('id, sku, nombre, variante, codigo_barras')
    .or(`codigo_barras.eq.${c},sku.eq.${c}`)
    .eq('activo', true)
    .limit(1)
    .maybeSingle()
  return data || null
}

/**
 * Busca productos por texto (nombre, variante, código de barras o sku)
 */
export async function bxTxt(texto) {
  if (!texto?.trim()) return []
  const q = texto.trim()
  const { data } = await supabase
    .from('productos')
    .select('id, sku, nombre, variante, codigo_barras')
    .or(`nombre.ilike.%${q}%,variante.ilike.%${q}%,codigo_barras.ilike.%${q}%,sku.ilike.%${q}%`)
    .eq('activo', true)
    .limit(20)
  return data || []
}

/**
 * Trae todos los productos del cliente autenticado
 */
export async function getProductos() {
  const { data } = await supabase
    .from('productos')
    .select('id, sku, nombre, variante, codigo_barras, activo, created_at')
    .eq('activo', true)
    .order('nombre')
  return data || []
}

/**
 * Crea un producto nuevo. Requiere nombre y codigo_barras; sku es opcional.
 */
export async function crearProducto({ sku, nombre, variante, codigo_barras }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('cliente_id')
    .eq('id', user.id)
    .maybeSingle()
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
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Importa un array de productos (upsert por codigo_barras)
 */
export async function importarProductos(rows) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('cliente_id')
    .eq('id', user.id)
    .maybeSingle()
  if (!perfil) throw new Error('No se encontró el perfil del usuario.')

  const items = rows.map(r => {
    const skuRaw = String(r.sku ?? r.SKU ?? '').trim()
    return {
      cliente_id:    perfil.cliente_id,
      sku:           skuRaw || null,
      nombre:        String(r.nombre || '').trim(),
      variante:      String(r.variante || '').trim(),
      codigo_barras: String(r.codigo_barras || '').trim(),
      activo:        true,
    }
  }).filter(r => r.codigo_barras && r.nombre)

  const { error } = await supabase
    .from('productos')
    .upsert(items, { onConflict: 'cliente_id,codigo_barras' })

  if (error) throw new Error(error.message)
  return items.length
}
