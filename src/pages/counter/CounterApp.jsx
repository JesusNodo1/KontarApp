import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { logout as doLogout, getDeviceId } from '../../services/auth'
import {
  getInventarioActivo, getTotalProductos,
  getZonas, crearZona as dbCrearZona,
  finalizarZona as dbFinalizarZona,
  finalizarInventario as dbFinalizarInventario,
  fmtFecha,
} from '../../services/conteoService'
import InventarioScreen from './InventarioScreen'
import ZonasScreen      from './ZonasScreen'
import ConteoScreen     from './ConteoScreen'
import { B } from '../../constants/theme'

const POS_KEY = 'kontar_pos'

export default function CounterApp() {
  const [screen,     setScreen]     = useState('inventario')
  const [inv,        setInv]        = useState(null)
  const [zonas,      setZonas]      = useState([])
  const [zonaActiva, setZonaActiva] = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const deviceId = getDeviceId()

  // Ref para leer screen actual dentro del listener popstate sin stale closure
  const screenRef = useRef(screen)
  useEffect(() => { screenRef.current = screen }, [screen])

  /* ─── Carga de datos ─────────────────────────────────────────────── */
  const loadData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [invData, total] = await Promise.all([getInventarioActivo(), getTotalProductos()])
      if (invData) {
        setInv({ ...invData, total_productos: total, fecha_inicio: fmtFecha(invData.fecha_inicio), fecha_limite: fmtFecha(invData.fecha_limite) })
        const zonasData = await getZonas(invData.id)
        setZonas(zonasData)
      } else {
        setInv(null)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  /* ─── Caso 1: Restaurar posición tras recarga ────────────────────── */
  useEffect(() => {
    if (loading) return
    const saved = sessionStorage.getItem(POS_KEY)
    if (!saved) return
    try {
      const { screen: s, zonaId } = JSON.parse(saved)
      if (s === 'zonas') {
        setScreen('zonas')
      } else if (s === 'conteo' && zonaId) {
        setZonas(prev => {
          const z = prev.find(z => z.id === zonaId)
          if (z) { setZonaActiva(z); setScreen('conteo') }
          else     setScreen('zonas')
          return prev
        })
      }
    } catch {
      sessionStorage.removeItem(POS_KEY)
    }
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Persistir posición en sessionStorage ───────────────────────── */
  useEffect(() => {
    if (screen === 'inventario') {
      sessionStorage.removeItem(POS_KEY)
    } else {
      sessionStorage.setItem(POS_KEY, JSON.stringify({
        screen,
        zonaId: zonaActiva?.id ?? null,
      }))
    }
  }, [screen, zonaActiva])

  /* ─── Caso 2: Botón atrás del navegador ─────────────────────────── */
  useEffect(() => {
    const handlePop = () => {
      const cur = screenRef.current
      if (cur === 'conteo') {
        setZonaActiva(null)
        setScreen('zonas')
      } else if (cur === 'zonas') {
        setScreen('inventario')
      }
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  /* ─── Navegación interna (empuja entradas al historial) ──────────── */
  const goZonas  = () => {
    window.history.pushState({ kontar: 'zonas' }, '')
    setScreen('zonas'); setZonaActiva(null)
  }
  const goInicio = () => { setScreen('inventario'); loadData() }
  const goConteo = z => {
    window.history.pushState({ kontar: 'conteo', zonaId: z.id }, '')
    setZonaActiva(z); setScreen('conteo')
  }

  /* ─── Acciones ───────────────────────────────────────────────────── */
  const crearZona = async (nombre, descripcion) => {
    const z = await dbCrearZona(inv.id, nombre, descripcion)
    setZonas(p => [...p, z])
    return z
  }

  const finZona = async (zona_id) => {
    await dbFinalizarZona(zona_id)
    setZonas(p => p.map(z => z.id === zona_id ? { ...z, finalizada: true } : z))
  }

  const handleFinalizarInventario = async () => {
    const todas = zonas.every(z => z.finalizada)
    if (!todas) {
      if (!confirm('Hay zonas sin finalizar. ¿Querés cerrar el inventario de todas formas?')) return
    }
    await dbFinalizarInventario(inv.id)
    await loadData()
  }

  const handleLogout = async () => {
    sessionStorage.removeItem(POS_KEY)
    await doLogout()
    signOut()
    navigate('/login', { replace: true })
  }

  /* ─── Renders de estado ──────────────────────────────────────────── */
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3F4F6' }}>
      <div className="spin" style={{ width: 28, height: 28, border: '3px solid #E5E7EB', borderTopColor: B, borderRadius: '50%' }} />
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#F3F4F6', padding: 24 }}>
      <p style={{ fontSize: 14, color: '#DC2626', textAlign: 'center' }}>Error al cargar datos: {error}</p>
      <button onClick={loadData} style={{ padding: '12px 24px', background: B, color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Reintentar</button>
    </div>
  )

  if (!inv) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, background: '#F3F4F6', padding: 24 }}>
      <div style={{ width: 56, height: 56, background: '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2} strokeLinecap="square">
          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1={12} y1="22.08" x2={12} y2={12}/>
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Sin inventario activo</div>
        <div style={{ fontSize: 13, color: '#6B7280' }}>No hay ningún inventario abierto. Contactá a tu administrador.</div>
      </div>
      <button onClick={handleLogout} style={{ padding: '12px 24px', background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
        Cerrar sesión
      </button>
    </div>
  )

  if (screen === 'inventario')
    return (
      <InventarioScreen
        inv={inv} zonas={zonas}
        onEntrar={goZonas}
        user={user} deviceId={deviceId} onLogout={handleLogout}
      />
    )

  if (screen === 'zonas')
    return (
      <ZonasScreen
        inv={inv} zonas={zonas}
        onBack={goInicio}
        onZonaSelect={goConteo}
        onCrearZona={crearZona}
        onFinalizarInventario={handleFinalizarInventario}
      />
    )

  if (screen === 'conteo' && zonaActiva)
    return (
      <ConteoScreen
        zona={zonaActiva} inv={inv}
        onBack={() => { goZonas(); loadData() }}
        onZonaFinalizada={finZona}
        user={user}
      />
    )

  return null
}
