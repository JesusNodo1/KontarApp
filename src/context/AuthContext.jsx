import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../services/supabase'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

function getAccessToken() {
  const proj = SUPABASE_URL.split('//')[1].split('.')[0]
  const raw  = localStorage.getItem(`sb-${proj}-auth-token`)
  if (!raw) return null
  try { return JSON.parse(raw).access_token } catch { return null }
}

async function restGet(path) {
  const token = getAccessToken()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey:        SUPABASE_ANON,
      Authorization: `Bearer ${token || SUPABASE_ANON}`,
    },
  })
  if (!res.ok) return null
  return res.json()
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let resolved = false

    function resolve() {
      if (!resolved && mounted) { resolved = true; setLoading(false) }
    }

    const timeout = setTimeout(resolve, 4000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (session?.user) {
        await _cargarPerfil(session.user)
      } else {
        setUser(null)
      }
      resolve()
      clearTimeout(timeout)
    })

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  async function _cargarPerfil(authUser) {
    try {
      const perfiles = await restGet(`perfiles?id=eq.${authUser.id}&select=nombre,rol,cliente_id`)
      const perfil = perfiles?.[0]
      if (perfil) {
        setUser({ id: authUser.id, email: authUser.email, ...perfil })
      }
    } catch (err) {
      console.error('[AuthContext] _cargarPerfil error:', err)
    }
  }

  function signIn(userData) { setUser(userData) }
  function signOut()        { setUser(null) }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3F4F6' }}>
        <div className="spin" style={{ width: 28, height: 28, border: '3px solid #E5E7EB', borderTopColor: '#3B82F6', borderRadius: '50%' }} />
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
