-- ============================================================================
-- KontarApp · Rediseño inventario (columnas del historial)
-- RPC que devuelve el resumen valorizado por inventario en una sola consulta,
-- para llenar "Existencia valorizada" y "% Dif." en la lista de inventarios.
--
-- security invoker → corre con los permisos del usuario, así RLS sigue acotando
-- por cliente. Sin parámetros: devuelve todos los inventarios que el usuario ve.
-- inventario_id se devuelve como text para no depender del tipo (uuid/bigint).
-- Correr en el SQL Editor de Supabase.
-- ============================================================================

create or replace function public.kontar_resumen_valorizado()
returns table (
  inventario_id          text,
  existencia_valorizada  numeric,
  existencia_teorica     numeric,
  diferencia_valorizada  numeric,
  pct_diferencia         numeric,
  con_costo              integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with teo as (
    -- Solo filas del teórico que tienen costo (lo demás no se puede valorizar).
    select t.inventario_id, t.producto_id, t.cantidad as teorico, t.costo_unitario
    from inventario_stock_teorico t
    where t.costo_unitario is not null
  ),
  cont as (
    select c.inventario_id, c.producto_id, sum(c.cantidad) as contado
    from conteos c
    group by c.inventario_id, c.producto_id
  )
  select
    teo.inventario_id::text,
    sum(coalesce(cont.contado, 0) * teo.costo_unitario)                        as existencia_valorizada,
    sum(teo.teorico * teo.costo_unitario)                                      as existencia_teorica,
    sum((coalesce(cont.contado, 0) - teo.teorico) * teo.costo_unitario)        as diferencia_valorizada,
    case when sum(teo.teorico * teo.costo_unitario) > 0
         then abs(sum((coalesce(cont.contado, 0) - teo.teorico) * teo.costo_unitario))
              / sum(teo.teorico * teo.costo_unitario) * 100
         else null end                                                        as pct_diferencia,
    count(*)::int                                                             as con_costo
  from teo
  left join cont
    on cont.inventario_id = teo.inventario_id
   and cont.producto_id   = teo.producto_id
  group by teo.inventario_id;
$$;

grant execute on function public.kontar_resumen_valorizado() to authenticated;
