import * as XLSX from 'xlsx'
import { supabase } from './supabase'

const PAGE = 1000

async function fetchAllPaginated(builder) {
  let all = []
  let from = 0
  while (true) {
    const { data, error } = await builder.range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

/**
 * Detalle de conteos de un inventario (una fila por producto+zona),
 * con datos de producto, zona y usuario. Paginado.
 */
export async function getReporteConteo(inventario_id) {
  return fetchAllPaginated(
    supabase
      .from('conteos')
      .select('cantidad, updated_at, producto:producto_id(id, sku, nombre, variante, codigo_barras), zona:zona_id(id, nombre), usuario:perfiles!conteos_usuario_perfil_fkey(nombre)')
      .eq('inventario_id', inventario_id)
      .order('updated_at', { ascending: false })
  )
}

/**
 * Auditoría: todos los scans unitarios de un inventario con prev/next/delta.
 * Más reciente primero. Paginado. Resuelve el nombre del usuario por separado
 * para no depender de un nombre de FK específico.
 */
export async function getReporteAuditoria(inventario_id) {
  const scans = await fetchAllPaginated(
    supabase
      .from('conteo_scans')
      .select('id, prev, next, delta, created_at, usuario_id, producto:producto_id(sku, nombre, variante, codigo_barras), zona:zona_id(nombre)')
      .eq('inventario_id', inventario_id)
      .order('created_at', { ascending: false })
  )
  const ids = [...new Set(scans.map(s => s.usuario_id).filter(Boolean))]
  let userMap = {}
  if (ids.length > 0) {
    const { data: perfs } = await supabase
      .from('perfiles')
      .select('id, nombre')
      .in('id', ids)
    userMap = Object.fromEntries((perfs || []).map(p => [p.id, p.nombre]))
  }
  return scans.map(s => ({ ...s, usuario: { nombre: userMap[s.usuario_id] || '—' } }))
}

/**
 * Histórico de inventarios cerrados de un depósito, con métricas agregadas.
 * Para cada inventario: nº de productos contados, total unidades, fechas.
 */
export async function getReporteHistorico(deposito_id) {
  const { data: invs, error } = await supabase
    .from('inventarios')
    .select('id, nombre, estado, fecha_inicio, fecha_limite, responsable, created_at')
    .eq('deposito_id', deposito_id)
    .eq('estado', 'cerrado')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  if (!invs || invs.length === 0) return []

  const out = []
  for (const inv of invs) {
    const conteos = await fetchAllPaginated(
      supabase
        .from('conteos')
        .select('cantidad, producto_id')
        .eq('inventario_id', inv.id)
    )
    const productos   = new Set(conteos.map(c => c.producto_id)).size
    const unidades    = conteos.reduce((s, c) => s + (Number(c.cantidad) || 0), 0)

    const { count: zonasTotal } = await supabase
      .from('zonas')
      .select('id', { count: 'exact', head: true })
      .eq('inventario_id', inv.id)

    out.push({
      ...inv,
      productos,
      unidades,
      zonas: zonasTotal || 0,
    })
  }
  return out
}

/**
 * Exporta filas a un archivo .xlsx descargable.
 * @param {Array<object>} rows  filas con las claves a exportar
 * @param {Array<{key:string,label:string}>} columns  columnas a incluir, en orden
 * @param {string} filename     nombre del archivo (sin extensión)
 * @param {string} sheetName    nombre de la hoja
 */
export function exportToXlsx(rows, columns, filename, sheetName = 'Reporte') {
  const data = rows.map(r => {
    const o = {}
    for (const c of columns) o[c.label] = r[c.key] ?? ''
    return o
  })
  const ws = XLSX.utils.json_to_sheet(data, { header: columns.map(c => c.label) })
  ws['!cols'] = columns.map(c => ({ wch: Math.max(c.label.length + 2, 14) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `${filename}_${stamp}.xlsx`)
}
