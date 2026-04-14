import { getAccessToken } from './auth'

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vendor-admin`

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

export const getLicencias       = ()                    => vFetch('GET')
export const crearLicencia      = (data)                => vFetch('POST', '', data)
export const toggleLicencia     = (licencia_id, activa) => vFetch('PATCH', '', { licencia_id, activa })
export const getUsuariosCliente = (clienteId)           => vFetch('GET', `/${clienteId}/usuarios`)
