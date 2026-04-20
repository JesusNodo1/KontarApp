import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { logout } from '../../services/auth'
import { B, BL, G } from '../../constants/theme'

const NAV_ITEMS = [
  {
    to: '/admin/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
        <rect x={3} y={3} width={7} height={7}/><rect x={14} y={3} width={7} height={7}/>
        <rect x={3} y={14} width={7} height={7}/><rect x={14} y={14} width={7} height={7}/>
      </svg>
    ),
  },
  {
    to: '/admin/productos',
    label: 'Productos',
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1={12} y1="22.08" x2={12} y2={12}/>
      </svg>
    ),
  },
  {
    to: '/admin/usuarios',
    label: 'Usuarios',
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx={9} cy={7} r={4}/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
  {
    to: '/admin/inventarios',
    label: 'Inventarios',
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
        <rect x={9} y={3} width={6} height={4}/><path d="M9 12h6M9 16h4"/>
      </svg>
    ),
  },
  {
    to: '/admin/sucursales',
    label: 'Sucursales',
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
]

export default function AdminLayout() {
  const [sideOpen, setSideOpen] = useState(false)
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    signOut()
    navigate('/login', { replace: true })
  }

  const navLinkStyle = ({ isActive }) => ({
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '11px 16px', fontSize: 14, fontWeight: isActive ? 700 : 500,
    color: isActive ? B : '#374151',
    background: isActive ? BL : 'transparent',
    borderLeft: isActive ? `3px solid ${B}` : '3px solid transparent',
    textDecoration: 'none', cursor: 'pointer',
    transition: 'background .15s',
  })

  const Sidebar = () => (
    <div style={{ width: 220, background: '#fff', borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #E5E7EB' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, background: B, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="square">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1={12} y1="22.08" x2={12} y2={12}/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', lineHeight: 1.1 }}>KontarApp</div>
            <div style={{ fontSize: 10, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Admin</div>
          </div>
        </div>
      </div>

      {/* nav */}
      <nav style={{ flex: 1, paddingTop: 8 }}>
        {NAV_ITEMS.map(item => (
          <NavLink key={item.to} to={item.to} style={navLinkStyle} onClick={() => setSideOpen(false)}>
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* user + logout */}
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
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* sidebar desktop */}
      <div style={{ display: 'none', height: '100%' }} className="admin-sidebar-desktop">
        <Sidebar />
      </div>

      {/* sidebar mobile overlay */}
      {sideOpen && (
        <div onClick={() => setSideOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 220, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Sidebar />
          </div>
        </div>
      )}

      {/* main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* topbar */}
        <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <button
            onClick={() => setSideOpen(true)}
            className="admin-menu-btn"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#374151' }}
          >
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
              <line x1={3} y1={6} x2={21} y2={6}/><line x1={3} y1={12} x2={21} y2={12}/><line x1={3} y1={18} x2={21} y2={18}/>
            </svg>
          </button>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>KontarApp</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 13, color: '#6B7280' }}>{user?.nombre}</div>
        </div>

        {/* page content */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#F3F4F6' }}>
          <Outlet />
        </div>
      </div>

      {/* sidebar visible en desktop via CSS */}
      <style>{`
        @media (min-width: 768px) {
          .admin-sidebar-desktop { display: flex !important; }
          .admin-menu-btn { display: none !important; }
        }
      `}</style>
    </div>
  )
}
