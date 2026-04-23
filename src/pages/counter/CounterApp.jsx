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
import { getSucursales, getDepositos } from '../../services/adminService'
import InventarioScreen from './InventarioScreen'
import ConteoScreen     from './ConteoScreen'
import { B } from '../../constants/theme'

const POS_KEY = 'kontar_pos'

// Contenedor raíz fijo — evita que la barra del navegador mobile cambie las dimensiones
const ROOT = {
  position: 'fixed', inset: 0, overflow: 'hidden',
  display: 'flex', flexDirection: 'column',
  background: '#F3F4F6',
}

export default function CounterApp() {
  const [screen,     setScreen]     = useState('inventario')
  const [inv,        setInv]        = useState(null)
  const [invLoading, setInvLoading] = useState(false)
  const [zonas,      setZonas]      = useState([])
  const [zonaActiva, setZonaActiva] = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [sucursales, setSucursales] = useState([])
  const [depositos,  setDepositos]  = useState([])
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const deviceId = getDeviceId()

  const screenRef   = useRef(screen)
  const didMountRef = useRef(false)
  useEffect(() => { screenRef.current = screen }, [screen])

  /* ─── Carga inicial ──────────────────────────────────────────── */
  const loadData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [sucs, deps] = await Promise.all([getSucursales(), getDepositos()])
      setSucursales(sucs); setDepositos(deps)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  /* ─── Cargar inventario por depósito ─────────────────────────── */
  const loadInventario = useCallback(async (deposito_id, onComplete = null) => {
    if (!deposito_id) {
      setInv(null); setZonas([])
      if (onComplete) onComplete(null, [])
      return
    }
    setInvLoading(true); setInv(null); setZonas([])
    try {
      const [invData, total] = await Promise.all([
        getInventarioActivo(deposito_id),
        getTotalProductos(),
      ])
      if (invData) {
        const newInv = {
          ...invData,
          total_productos: total,
          fecha_inicio: fmtFecha(invData.fecha_inicio),
          fecha_limite: fmtFecha(invData.fecha_limite),
        }
        setInv(newInv)
        const zonasData = await getZonas(invData.id, deposito_id)
        setZonas(zonasData)
        if (onComplete) onComplete(newInv, zonasData)
      } else {
        if (onComplete) onComplete(null, [])
      }
    } catch (e) {
      console.error('Error al cargar inventario:', e.message)
      if (onComplete) onComplete(null, [])
    } finally { setInvLoading(false) }
  }, [])

  /* ─── Refrescar zonas ────────────────────────────────────────── */
  const refreshZonas = useCallback(async () => {
    if (!inv) return
    const zonasData = await getZonas(inv.id, inv.deposito_id)
    setZonas(zonasData)
  }, [inv])

  /* ─── Restaurar posición tras recarga ───────────────────────── */
  useEffect(() => {
    if (loading) return
    const saved = sessionStorage.getItem(POS_KEY)
    if (!saved) return
    try {
      const { screen: s, zonaId, depositoId } = JSON.parse(saved)
      if (!depositoId || s !== 'conteo' || !zonaId) { sessionStorage.removeItem(POS_KEY); return }
      loadInventario(depositoId, (loadedInv, loadedZonas) => {
        if (!loadedInv) return
        const z = loadedZonas.find(z => z.id === zonaId)
        if (z) { setZonaActiva(z); setScreen('conteo') }
      })
    } catch { sessionStorage.removeItem(POS_KEY) }
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Persistir posición ─────────────────────────────────────── */
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return }
    if (screen === 'inventario') {
      sessionStorage.removeItem(POS_KEY)
    } else if (screen === 'conteo' && inv && zonaActiva) {
      sessionStorage.setItem(POS_KEY, JSON.stringify({
        screen, zonaId: zonaActiva.id, depositoId: inv.deposito_id,
      }))
    }
  }, [screen, zonaActiva, inv])

  /* ─── Botón atrás del navegador ─────────────────────────────── */
  useEffect(() => {
    const handlePop = (e) => {
      // Si el estado que quedó tras el pop sigue siendo "conteo", significa
      // que solo se cerró un overlay interno (ej: cámara) — no navegamos.
      if (e.state?.kontar === 'conteo') return
      if (screenRef.current === 'conteo') {
        setZonaActiva(null); setScreen('inventario'); refreshZonas()
      }
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Navegación ─────────────────────────────────────────────── */
  const goConteo = z => {
    window.history.pushState({ kontar: 'conteo', zonaId: z.id }, '')
    setZonaActiva(z); setScreen('conteo')
  }
  const goInicio = () => {
    setZonaActiva(null); setScreen('inventario'); refreshZonas()
  }

  /* ─── Acciones ───────────────────────────────────────────────── */
  const crearZona = async (nombre, descripcion, deposito_id = null) => {
    const z = await dbCrearZona(inv.id, nombre, descripcion, deposito_id)
    setZonas(p => [...p, z]); return z
  }
  const finZona = async (zona_id) => {
    await dbFinalizarZona(zona_id)
    setZonas(p => p.map(z => z.id === zona_id ? { ...z, finalizada: true } : z))
  }
  const handleFinalizarInventario = async () => {
    const todas = zonas.every(z => z.finalizada)
    if (!todas && !confirm('Hay zonas sin finalizar. ¿Querés cerrar el inventario de todas formas?')) return
    await dbFinalizarInventario(inv.id)
    setInv(null); setZonas([])
  }
  const handleLogout = async () => {
    sessionStorage.removeItem(POS_KEY)
    await doLogout(); signOut()
    navigate('/login', { replace: true })
  }

  /* ─── Render único con contenedor fijo ──────────────────────── */
  return (
    <div style={ROOT}>
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spin" style={{ width: 28, height: 28, border: '3px solid #E5E7EB', borderTopColor: B, borderRadius: '50%' }} />
        </div>
      ) : error ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
          <p style={{ fontSize: 14, color: '#DC2626', textAlign: 'center' }}>Error al cargar datos: {error}</p>
          <button onClick={loadData} style={{ padding: '12px 24px', background: B, color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Reintentar</button>
        </div>
      ) : screen === 'conteo' && zonaActiva ? (
        <ConteoScreen
          zona={zonaActiva} inv={inv}
          onBack={goInicio}
          onZonaFinalizada={finZona}
          user={user}
        />
      ) : (
        <InventarioScreen
          inv={inv} invLoading={invLoading} zonas={zonas}
          sucursales={sucursales} depositos={depositos}
          onDepositoSelect={loadInventario}
          onEntrar={goConteo}
          onCrearZona={crearZona}
          onFinalizarInventario={handleFinalizarInventario}
          user={user} deviceId={deviceId} onLogout={handleLogout}
        />
      )}
    </div>
  )
}
