-- ============================================================================
-- KontarApp · Fase 1: columna api_config en clientes
-- Multi-tenant de credenciales del ERP externo. Hoy `api-externa` lee la URL
-- y el token desde variables de entorno globales del Edge Function, lo que
-- funciona con un solo cliente conectado por API. Para soportar N clientes
-- con distintos ERPs (o mismo ERP con distintas credenciales) las movemos a
-- una columna JSONB por cliente.
--
-- Esta migración SOLO agrega la columna, nullable, sin default. No cambia el
-- comportamiento de nada: los clientes existentes quedan con api_config = null
-- y el Edge Function `api-externa` sigue leyendo de env vars como hoy.
--
-- El corte real se hace en la Fase 2 (Edge Function con fallback a env vars).
--
-- Estructura esperada del JSON (cuando esté cargado):
--   {
--     "tipo":              "kontar",              -- adaptador a usar
--     "base_url":          "https://api.../v1",
--     "auth_modo":         "bearer",              -- "bearer" | "apikey" | "basic"
--     "token":             "xxxxx",               -- NUNCA devolver al front
--     "activo":            true,
--     "ultimo_test_ok":    null,                  -- timestamptz
--     "ultimo_test_error": null                   -- texto del último error
--   }
--
-- Correr en el SQL Editor de Supabase.
-- ============================================================================

alter table public.clientes
  add column if not exists api_config jsonb;

comment on column public.clientes.api_config is
  'Credenciales y config del ERP externo por cliente. Ver estructura en 2026-07-02_clientes_api_config.sql. '
  'El campo `token` es sensible: nunca exponerlo al front — getLicencias() y similares deben omitirlo.';

-- ── Migración del cliente productivo (Kontar) ──────────────────────────────
-- Cuando estés listo, copiá los valores actuales de las env vars del Edge
-- Function `api-externa` (base_url y token) y descomentá el bloque de abajo,
-- reemplazando los placeholders. NO se ejecuta automáticamente por seguridad.
--
-- update public.clientes
--    set api_config = jsonb_build_object(
--          'tipo',              'kontar',
--          'base_url',          '<<PEGAR_URL_ACTUAL>>',
--          'auth_modo',         'bearer',
--          'token',             '<<PEGAR_TOKEN_ACTUAL>>',
--          'activo',            true,
--          'ultimo_test_ok',    null,
--          'ultimo_test_error', null
--        )
--  where id = '<<UUID_DEL_CLIENTE_KONTAR>>'
--    and api_config is null;   -- salvaguarda: no piso config ya cargada
