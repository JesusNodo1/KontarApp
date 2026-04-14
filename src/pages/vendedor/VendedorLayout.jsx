import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { logout } from '../../services/auth'
import { B, BL } from '../../constants/theme'

export default function VendedorLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout(); signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F3F4F6' }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: '#fff', borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="square">
                <rect x={2} y={3} width={20} height={14} rx={1}/>
                <path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', lineHeight: 1.1 }}>KontarApp</div>
              <div style={{ fontSize: 10, color: '#7C3AED', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>Vendedor</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, paddingTop: 8 }}>
          <NavLink
            to="/vendedor/licencias"
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 16px', fontSize: 14, fontWeight: isActive ? 700 : 500,
              color: isActive ? '#7C3AED' : '#374151',
              background: isActive ? '#EDE9FE' : 'transparent',
              borderLeft: isActive ? '3px solid #7C3AED' : '3px solid transparent',
              textDecoration: 'none',
            })}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
              <rect x={2} y={7} width={20} height={14} rx={1}/>
              <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
              <line x1={12} y1={12} x2={12} y2={16}/><line x1={10} y1={14} x2={14} y2={14}/>
            </svg>
            Licencias
          </NavLink>
        </nav>

        <div style={{ borderTop: '1px solid #E5E7EB', padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{user?.nombre}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>{user?.email}</div>
          <button
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6B7280', padding: 0, fontWeight: 500 }}
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
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
