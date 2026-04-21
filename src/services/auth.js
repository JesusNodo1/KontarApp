import { supabase } from './supabase'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Devuelve un ID único y persistente para este dispositivo/navegador
 */
export function getDeviceId() {
  let id = localStorage.getItem('_ktr_device_id')
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem('_ktr_device_id', id)
  }
  return id
}

/**
 * Obtiene el access token de la sesión activa desde localStorage
 */
export function getAccessToken() {
  const key = `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try { return JSON.parse(raw).access_token } catch { return null }
}

/**
 * Hace una petición REST directa a Supabase (evita bugs del cliente JS al llamar desde React)
 */
async function restFetch(path, options = {}) {
  const token = getAccessToken()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${token || SUPABASE_ANON}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!res.ok && res.status !== 201 && res.status !== 204) {
    const body = await res.text()
    throw new Error(body || `HTTP ${res.status}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

/**
 * Inicia sesión con Supabase Auth y carga el perfil del usuario
 * @returns {{ email, rol, nombre, cliente_id, id }}
 */
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error('Email o contraseña incorrectos.')

  // 1. Buscar en perfiles (admin / contador)
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nombre, rol, cliente_id')
    .eq('id', data.user.id)
    .maybeSingle()

  if (perfil && perfil.rol !== 'superadmin') {
    return {
      id:         data.user.id,
      email:      data.user.email,
      nombre:     perfil.nombre,
      rol:        perfil.rol,
      cliente_id: perfil.cliente_id,
    }
  }

  // 2. Si no está en perfiles (o tiene rol superadmin en perfiles), verificar tabla superadmin por email
  const { data: sadmin } = await supabase
    .from('superadmin')
    .select('nombre, activo')
    .eq('email', data.user.email)
    .maybeSingle()

  if (sadmin && sadmin.activo) {
    return {
      id:         data.user.id,
      email:      data.user.email,
      nombre:     sadmin.nombre,
      rol:        'superadmin',
      cliente_id: null,
    }
  }

  await supabase.auth.signOut()
  throw new Error('No se encontró el perfil del usuario.')
}

/**
 * Valida el código de licencia y activa la terminal en Supabase.
 * Usa fetch directo para evitar bloqueos del cliente supabase-js en React.
 */
export async function activarTerminal(codigo) {
  const deviceId = getDeviceId()
  const codigoUp = codigo.trim().toUpperCase()

  // 1. Buscar licencia
  const licencias = await restFetch(
    `licencias?codigo=eq.${encodeURIComponent(codigoUp)}&select=id,cliente_id,activa`
  )
  const licencia = licencias?.[0]
  if (!licencia) throw new Error('Código de licencia inválido o expirado.')
  if (!licencia.activa) throw new Error('Esta licencia está desactivada.')

  // 2. Upsert terminal (on_conflict must be in URL for PostgREST)
  await restFetch('terminales?on_conflict=device_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      device_id:   deviceId,
      licencia_id: licencia.id,
      cliente_id:  licencia.cliente_id,
      activa:      true,
    }),
  })

  return true
}

/**
 * Verifica si el device_id ya está registrado y activo en la DB.
 * Usa anon key — no requiere sesión.
 * @returns {boolean}
 */
export async function checkTerminal() {
  const deviceId = localStorage.getItem('_ktr_device_id')
  if (!deviceId) return false
  const data = await restFetch(
    `terminales?device_id=eq.${encodeURIComponent(deviceId)}&activa=eq.true&select=id&limit=1`
  )
  return Array.isArray(data) && data.length > 0
}

/**
 * Cierra sesión en Supabase
 */
export async function logout() {
  await supabase.auth.signOut()
}
