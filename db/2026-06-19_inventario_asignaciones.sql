-- ============================================================================
-- KontarApp · Asignación de contadores a inventarios
-- Tabla N:N opcional: si un inventario tiene filas acá, sólo esos perfiles
-- lo ven en el contador. Si no tiene filas, lo ven todos los contadores del
-- cliente (comportamiento previo).
-- Correr en el SQL Editor de Supabase.
--
-- Igual que inventario_productos: CREATE TABLE AS ... WHERE false para que
-- los tipos de inventario_id / perfil_id / cliente_id coincidan con los PKs.
-- ============================================================================

create table if not exists public.inventario_asignaciones as
  select
    inv.id as inventario_id,
    p.id   as perfil_id,
    cli.id as cliente_id
  from public.inventarios inv,
       public.perfiles    p,
       public.clientes    cli
  where false;

alter table public.inventario_asignaciones
  add column if not exists created_at timestamptz not null default now();

alter table public.inventario_asignaciones
  alter column inventario_id set not null,
  alter column perfil_id     set not null,
  alter column cliente_id    set not null;

alter table public.inventario_asignaciones
  add constraint inventario_asignaciones_pkey primary key (inventario_id, perfil_id);

alter table public.inventario_asignaciones
  add constraint inventario_asignaciones_inventario_fk
    foreign key (inventario_id) references public.inventarios(id) on delete cascade,
  add constraint inventario_asignaciones_perfil_fk
    foreign key (perfil_id) references public.perfiles(id) on delete cascade,
  add constraint inventario_asignaciones_cliente_fk
    foreign key (cliente_id) references public.clientes(id) on delete cascade;

create index if not exists idx_inv_asig_inventario on public.inventario_asignaciones(inventario_id);
create index if not exists idx_inv_asig_perfil     on public.inventario_asignaciones(perfil_id);
create index if not exists idx_inv_asig_cliente    on public.inventario_asignaciones(cliente_id);

-- ── RLS (multi-tenant por cliente_id) ──
alter table public.inventario_asignaciones enable row level security;

create policy inventario_asignaciones_rw on public.inventario_asignaciones
  for all
  to authenticated
  using      (cliente_id = (select p.cliente_id from public.perfiles p where p.id = auth.uid()))
  with check (cliente_id = (select p.cliente_id from public.perfiles p where p.id = auth.uid()));
