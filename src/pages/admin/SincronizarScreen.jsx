import { useState } from 'react'
import { G } from '../../constants/theme'
import { sincronizarTodo } from '../../services/apiExternaService'
import { useAuth } from '../../context/AuthContext'
import Spinner from '../../components/Spinner'

export default function SincronizarScreen() {
  const { user } = useAuth()
  const apiHabilitada = user?.fuente_sync === 'api'
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  const handleSync = async () => {
    if (!confirm('¿Sincronizar sucursales, depósitos y productos desde la API externa? Esto puede demorar varios segundos.')) return
    setSyncing(true); setSyncMsg('Iniciando...')
    try {
      const r = await sincronizarTodo(setSyncMsg)
      const partes = [`✓ ${r.sucursales} sucursales`, `${r.depositos} depósitos`, `${r.productos} productos`]
      if (r.sinSucursal > 0) partes.push(`(${r.sinSucursal} depósitos sin sucursal)`)
      if (r.descartadas > 0) partes.push(`(${r.descartadas} productos descartados)`)
      setSyncMsg(partes.join(' · '))
    } catch (e) {
      setSyncMsg(`✕ ${e.message}`)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 640, margin: '0 auto' }}>
      {/* header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Sincronizar API</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Trae sucursales, depósitos y productos desde el ERP externo.</div>
      </div>

      {!apiHabilitada ? (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '14px 16px', fontSize: 13, color: '#92400E' }}>
          Este cliente no tiene la sincronización por API habilitada. Los productos se cargan a mano o por Excel desde <b>Productos</b>.
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', padding: '22px' }}>
          <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16, lineHeight: 1.5 }}>
            La sincronización actualiza el catálogo local con lo que devuelve el ERP. Se ejecuta en orden:
            primero sucursales, luego depósitos y por último productos.
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: syncing ? '#F3F4F6' : '#fff', border: `2px solid ${G}`, color: G, fontWeight: 700, fontSize: 14, cursor: syncing ? 'not-allowed' : 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}
          >
            {syncing
              ? <><Spinner /> Sincronizando...</>
              : <><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> Sincronizar ahora</>
            }
          </button>
          {syncMsg && (
            <div style={{ marginTop: 16, fontSize: 13, color: syncMsg.startsWith('✕') ? '#DC2626' : '#374151', fontFamily: "'DM Mono',monospace" }}>
              {syncMsg}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
