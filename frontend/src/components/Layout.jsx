// src/components/Layout.jsx - Layout principal del panel admin
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const menuItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/tickets', label: 'Tickets', icon: '📝' },
  { path: '/transportes', label: 'Transportes', icon: '🚛' },
  { path: '/clientes', label: 'Clientes', icon: '👥' },
  { path: '/whatsapp', label: 'WhatsApp', icon: '💬' },
  { path: '/configuracion', label: 'Configuración', icon: '⚙️' },
];

export default function Layout({ children }) {
  const { admin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f2f5' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240, background: '#1a1a2e', color: '#fff', padding: '20px 0',
        display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: 0,
        zIndex: 100
      }}>
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid #333', textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 22, letterSpacing: 2 }}>🚛 FALC</h2>
          <small style={{ color: '#aaa' }}>Logística de Carga</small>
        </div>
        <nav style={{ flex: 1, padding: '20px 0' }}>
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px',
                color: location.pathname === item.path ? '#fff' : '#aaa',
                background: location.pathname === item.path ? '#16213e' : 'transparent',
                textDecoration: 'none', fontSize: 14, borderLeft: location.pathname === item.path ? '3px solid #e94560' : '3px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              <span>{item.icon}</span> {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ padding: '15px 20px', borderTop: '1px solid #333' }}>
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>
            👤 {admin?.nombre || admin?.username}
          </div>
          <button onClick={handleLogout} style={{
            background: '#e94560', color: '#fff', border: 'none', padding: '8px 16px',
            borderRadius: 4, cursor: 'pointer', fontSize: 13, width: '100%'
          }}>
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: 24, marginLeft: 240 }}>
        {children}
      </main>
    </div>
  );
}
