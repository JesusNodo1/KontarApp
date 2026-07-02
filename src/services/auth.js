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

  // 1. Buscar en perfiles (admin / contador / soporte)
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nombre, rol, cliente_id')
    .eq('id', data.user.id)
    .maybeSingle()

  if (perfil && perfil.rol === 'soporte') {
    return {
      id:         data.user.id,
      email:      data.user.email,
      nombre:     perfil.nombre,
      rol:        'soporte',
      cliente_id: null,
    }
  }

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
 * Valida el código de licencia y activa/registra la terminal.
 *
 * La escritura pasa por el Edge Function `activate-terminal` (service_role)
 * porque la RLS de `terminales` impide que un usuario del cliente B haga
 * upsert sobre una fila que estaba vinculada al cliente A. El backend hace
 * las mismas validaciones y encima usa UNIQUE (device_id, cliente_id): si
 * el mismo dispositivo se activa para dos clientes distintos, coexisten
 * las dos filas.
 *
 * @param {string} codigo Código de licencia.
 * @param {number|null} expectedClienteId  Ignorado si no hay JWT. Cuando lo
 *   hay, el backend valida contra el cliente del usuario. Se sigue pasando
 *   para dar el error temprano en el cliente antes del roundtrip.
 */
export async function activarTerminal(codigo, expectedClienteId = null) {
  const deviceId = getDeviceId()
  const codigoUp = codigo.trim().toUpperCase()

  // Validación temprana en el cliente (opcional, para evitar el roundtrip
  // cuando ya sabemos que va a fallar). El backend igual valida.
  if (expectedClienteId != null) {
    const licencias = await restFetch(
      `licencias?codigo=eq.${encodeURIComponent(codigoUp)}&select=cliente_id,activa`
    )
    const licencia = licencias?.[0]
    if (!licencia) throw new Error('Código de licencia inválido o expirado.')
    if (!licencia.activa) throw new Error('Esta licencia está desactivada.')
    if (licencia.cliente_id !== expectedClienteId) {
      throw new Error('Este código pertenece a otra empresa. Cerrá sesión e ingresá con las credenciales correspondientes al código.')
    }
  }

  const token = getAccessToken()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/activate-terminal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ codigo: codigoUp, device_id: deviceId }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`)
  return true
}

/**
 * Verifica si el device_id está registrado y activo en la DB para el cliente dado.
 * Usa anon key — no requiere sesión.
 *
 * @param {number|null} clienteId  Si viene, exige que la terminal esté vinculada a
 *   ese cliente. Sin esta comprobación, un usuario de cliente B podría entrar en
 *   una terminal activada para cliente A sin tener que ingresar su propio código.
 *   Si no viene (superadmin/soporte, o sin sesión aún), sólo valida existencia.
 * @returns {boolean}
 */
export async function checkTerminal(clienteId = null) {
  const deviceId = localStorage.getItem('_ktr_device_id')
  if (!deviceId) return false
  const filtroCli = clienteId != null ? `&cliente_id=eq.${clienteId}` : ''
  const data = await restFetch(
    `terminales?device_id=eq.${encodeURIComponent(deviceId)}${filtroCli}&activa=eq.true&select=id&limit=1`
  )
  return Array.isArray(data) && data.length > 0
}

/**
 * Cierra sesión en Supabase
 */
export async function logout() {
  await supabase.auth.signOut()
}
