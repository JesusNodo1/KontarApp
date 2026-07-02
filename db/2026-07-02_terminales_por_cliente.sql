-- ============================================================================
-- KontarApp · Cambio de UNIQUE en terminales
--
-- Antes: UNIQUE (device_id) — un dispositivo sólo podía estar registrado
--        para un cliente a la vez. Reactivar con licencia de otro cliente
--        pisaba la fila y borraba la historia.
--
-- Ahora: UNIQUE (device_id, cliente_id) — cada dispositivo puede tener su
--        propia fila por cada cliente que lo usó, y las filas coexisten.
--        `checkTerminal` sigue funcionando porque filtra por (device_id +
--        cliente_id + activa=true).
--
-- El nombre del constraint puede variar según cómo se creó la tabla. Este
-- script intenta detectar y eliminar cualquier UNIQUE sobre sólo `device_id`,
-- luego agrega el nuevo. Es idempotente.
--
-- Correr en el SQL Editor de Supabase.
-- ============================================================================

-- 1. Eliminar cualquier UNIQUE constraint existente que sea solo (device_id).
do $$
declare
  r record;
begin
  for r in
    select tc.constraint_name
      from information_schema.table_constraints tc
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
       and ccu.table_schema    = tc.table_schema
     where tc.table_schema    = 'public'
       and tc.table_name      = 'terminales'
       and tc.constraint_type = 'UNIQUE'
       and ccu.column_name    = 'device_id'
     group by tc.constraint_name
    having count(*) = 1   -- sólo constraints que involucran únicamente device_id
  loop
    execute format('alter table public.terminales drop constraint %I', r.constraint_name);
  end loop;
end $$;

-- 2. Eliminar cualquier UNIQUE index suelto (sin constraint) sobre solo (device_id).
do $$
declare
  r record;
begin
  for r in
    select i.indexname
      from pg_indexes i
     where i.schemaname = 'public'
       and i.tablename  = 'terminales'
       and i.indexdef like '%UNIQUE%'
       and i.indexdef like '%(device_id)%'
       and i.indexdef not like '%cliente_id%'
       -- excluir los que ya son constraints (los borra el bloque anterior)
       and not exists (
         select 1 from information_schema.table_constraints tc
          where tc.table_schema = 'public' and tc.constraint_name = i.indexname
       )
  loop
    execute format('drop index if exists public.%I', r.indexname);
  end loop;
end $$;

-- 3. Constraint UNIQUE nuevo por (device_id, cliente_id).
--    Se agrega como CONSTRAINT (no sólo INDEX) para que PostgREST y
--    supabase-js lo detecten sin problemas al hacer upsert con on_conflict.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
     where table_schema = 'public'
       and table_name   = 'terminales'
       and constraint_name = 'terminales_device_cliente_key'
  ) then
    alter table public.terminales
      add constraint terminales_device_cliente_key unique (device_id, cliente_id);
  end if;
end $$;
