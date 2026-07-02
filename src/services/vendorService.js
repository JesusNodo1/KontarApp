import { getAccessToken } from './auth'

const EDGE_URL      = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vendor-admin`
const EDGE_TEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-api-config`

async function vFetch(method, path = '', body) {
  const token = getAccessToken()

  const res = await fetch(`${EDGE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok) throw new Error(json.error || json.message || `HTTP ${res.status}`)
  return json
}

async function testFetch(body) {
  const token = getAccessToken()
  const res = await fetch(EDGE_TEST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok) throw new Error(json.error || json.message || `HTTP ${res.status}`)
  return json
}

export const getLicencias        = ()                    => vFetch('GET')
export const crearLicencia       = (data)                => vFetch('POST', '', data)
export const toggleLicencia      = (licencia_id, activa) => vFetch('PATCH', '', { licencia_id, activa })
export const getUsuariosCliente  = (clienteId)           => vFetch('GET', `/${clienteId}/usuarios`)
export const resetPassword       = (user_id)             => vFetch('PATCH', '', { action: 'reset_password', user_id })

export const testApiPreview      = (base_url, token, tipo = 'kontar') =>
  testFetch({ mode: 'preview', base_url, token, tipo })
export const testApiSaved        = (cliente_id) =>
  testFetch({ mode: 'saved', cliente_id })

// Editar api_config de un cliente. Si `token` viene vacío, conserva el actual.
export const updateClienteApi    = (cliente_id, { base_url, token }) =>
  vFetch('PATCH', '', { action: 'update_api', cliente_id, base_url, token })
