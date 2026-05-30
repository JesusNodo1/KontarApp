-- ============================================================================
-- KontarApp · Rediseño inventario (Fase 2)
-- Tabla del subconjunto de productos elegido por inventario (selección del wizard).
-- Correr en el SQL Editor de Supabase.
--
-- Se crea con CREATE TABLE AS ... WHERE false para que los tipos de
-- inventario_id / producto_id / cliente_id COINCIDAN exactamente con los
-- PKs de las tablas existentes (uuid o bigint, da igual) y no fallen las FK.
-- ============================================================================

create table if not exists public.inventario_productos as
  select
    inv.id  as inventario_id,
    prod.id as producto_id,
    cli.id  as cliente_id
  from public.inventarios inv,
       public.productos    prod,
       public.clientes     cli
  where false;

-- created_at + NOT NULL en las columnas
alter table public.inventario_productos
  add column if not exists created_at timestamptz not null default now();

alter table public.inventario_productos
  alter column inventario_id set not null,
  alter column producto_id   set not null,
  alter column cliente_id    set not null;

-- PK compuesta (un producto no se repite dentro del mismo inventario)
alter table public.inventario_productos
  add constraint inventario_productos_pkey primary key (inventario_id, producto_id);

-- FKs con borrado en cascada
alter table public.inventario_productos
  add constraint inventario_productos_inventario_fk
    foreign key (inventario_id) references public.inventarios(id) on delete cascade,
  add constraint inventario_productos_producto_fk
    foreign key (producto_id) references public.productos(id) on delete cascade,
  add constraint inventario_productos_cliente_fk
    foreign key (cliente_id) references public.clientes(id) on delete cascade;

create index if not exists idx_inv_prod_inventario on public.inventario_productos(inventario_id);
create index if not exists idx_inv_prod_cliente    on public.inventario_productos(cliente_id);

-- ── RLS (multi-tenant por cliente_id, igual que el resto del esquema) ──
alter table public.inventario_productos enable row level security;

-- Cada usuario sólo ve/inserta filas de su propio cliente (vía perfiles.id = auth.uid()).
-- Si en tu esquema usás una función helper para el cliente del usuario
-- (p.ej. la policy de inventario_stock_teorico), reemplazá la subconsulta por esa.
create policy inventario_productos_rw on public.inventario_productos
  for all
  to authenticated
  using      (cliente_id = (select p.cliente_id from public.perfiles p where p.id = auth.uid()))
  with check (cliente_id = (select p.cliente_id from public.perfiles p where p.id = auth.uid()));
