import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { logout } from '../../services/auth'
import { B, BL } from '../../constants/theme'

export default function SoporteLayout() {
  const { user, signIn, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout(); signOut()
    navigate('/login', { replace: true })
  }

  const handleCambiarCliente = () => {
    signIn({ ...user, cliente_id: null })
    navigate('/soporte/select', { replace: true })
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F3F4F6' }}>

      {/* Sidebar */}
      <div style={{ width: 220, background: '#fff', borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, background: B, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="square">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', lineHeight: 1.1 }}>KontarApp</div>
              <div style={{ fontSize: 10, color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Soporte</div>
            </div>
          </div>
        </div>

        {/* Cliente activo */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', background: BL }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: B, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Cliente activo</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{user?.nombre_empresa || `ID #${user?.cliente_id}`}</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, paddingTop: 8 }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 16px', fontSize: 14, fontWeight: 700,
              color: B, background: BL, borderLeft: `3px solid ${B}`,
              cursor: 'default',
            }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
              <rect x={3} y={3} width={7} height={7}/><rect x={14} y={3} width={7} height={7}/>
              <rect x={3} y={14} width={7} height={7}/><rect x={14} y={14} width={7} height={7}/>
            </svg>
            Dashboard
          </div>
        </nav>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #E5E7EB', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{user?.nombre}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>{user?.email}</div>
          </div>
          <button
            onClick={handleCambiarCliente}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: B, padding: 0, fontWeight: 600 }}
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
              <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
            </svg>
            Cambiar cliente
          </button>
          <button
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#6B7280', padding: 0, fontWeight: 500 }}
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1={21} y1={12} x2={9} y2={12}/>
            </svg>
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Outlet />
      </div>
    </div>
  )
}
