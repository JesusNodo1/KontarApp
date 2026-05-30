-- ============================================================================
-- KontarApp · Rediseño inventario (Fase 2/3)
-- Columnas nuevas en productos para los datos que ya devuelve KONTAR_PRODUCTOS:
--   Costo  → valorización (existencia valorizada, dif. en Gs, % diferencia)
--   Marca  / Modelo → info adicional del producto
-- Clasificación se sigue guardando en `variante` (es lo que la app ya usa para agrupar).
-- Correr en el SQL Editor de Supabase. Después: re-sincronizar productos.
-- ============================================================================

alter table public.productos
  add column if not exists costo  numeric,
  add column if not exists marca  text,
  add column if not exists modelo text;
