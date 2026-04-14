const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vendor-admin`

function _getToken() {
  const key = `sb-${import.meta.env.VITE_SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`
  try { return JSON.parse(localStorage.getItem(key) || '{}').access_token || null } catch { return null }
}

async function vFetch(method, path = '', body) {
  const token = _getToken()
  const res = await fetch(`${EDGE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json
}

export const getLicencias      = ()               => vFetch('GET')
export const crearLicencia     = (data)           => vFetch('POST', '', data)
export const toggleLicencia    = (licencia_id, activa) => vFetch('PATCH', '', { licencia_id, activa })
export const getUsuariosCliente = (clienteId)     => vFetch('GET', `/${clienteId}/usuarios`)
