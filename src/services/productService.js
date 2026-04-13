import { supabase } from './supabase'

/**
 * Busca un producto por código de barras o SKU exacto
 */
export async function bxCod(codigo) {
  const c = codigo.trim()
  const { data } = await supabase
    .from('productos')
    .select('id, sku, nombre, variante, codigo_barras')
    .or(`sku.eq.${c},codigo_barras.eq.${c}`)
    .eq('activo', true)
    .limit(1)
    .maybeSingle()
  return data || null
}

/**
 * Busca productos por texto (nombre, variante o sku)
 */
export async function bxTxt(texto) {
  if (!texto?.trim()) return []
  const q = texto.trim()
  const { data } = await supabase
    .from('productos')
    .select('id, sku, nombre, variante, codigo_barras')
    .or(`nombre.ilike.%${q}%,variante.ilike.%${q}%,sku.ilike.%${q}%`)
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
 * Crea un producto nuevo
 */
export async function crearProducto({ sku, nombre, variante, codigo_barras }) {
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('cliente_id')
    .maybeSingle()

  const { data, error } = await supabase
    .from('productos')
    .insert({ sku, nombre, variante: variante || '', codigo_barras: codigo_barras || '', cliente_id: perfil.cliente_id })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Importa un array de productos (upsert por sku)
 */
export async function importarProductos(rows) {
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('cliente_id')
    .maybeSingle()

  const items = rows.map(r => ({
    cliente_id:    perfil.cliente_id,
    sku:           String(r.sku || '').trim(),
    nombre:        String(r.nombre || '').trim(),
    variante:      String(r.variante || '').trim(),
    codigo_barras: String(r.codigo_barras || '').trim(),
    activo:        true,
  })).filter(r => r.sku && r.nombre)

  const { error } = await supabase
    .from('productos')
    .upsert(items, { onConflict: 'cliente_id,sku' })

  if (error) throw new Error(error.message)
  return items.length
}
