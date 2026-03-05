// src/components/Layout.jsx - Layout principal responsivo + PWA
import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const menuItems = [
  { path: '/', label: 'Dashboard', icon: (
    <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
    </svg>
  ), permiso: 'dashboard' },
  { path: '/tickets', label: 'Tickets', icon: (
    <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ), permiso: 'tickets' },
  { path: '/transportes', label: 'Transportes', icon: (
    <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ), permiso: 'transportes' },
  { path: '/tipos-vehiculos', label: 'Tipos Vehículos', icon: (
    <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  ), permiso: 'tipos-vehiculos' },
  { path: '/clientes', label: 'Clientes', icon: (
    <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ), permiso: 'clientes' },
  { path: '/liquidaciones', label: 'Liquidaciones', icon: (
    <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ), permiso: 'liquidaciones' },
  { path: '/whatsapp', label: 'WhatsApp', icon: (
    <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ), permiso: 'whatsapp' },
  { path: '/usuarios', label: 'Usuarios', icon: (
    <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ), permiso: 'usuarios' },
  { path: '/configuracion', label: 'Configuración', icon: (
    <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ), permiso: 'configuracion' },
];

export default function Layout({ children }) {
  const { admin, logout, tienePermiso } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [showOfflineReady, setShowOfflineReady] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const updateHandlerRef = useRef(null);
  const sidebarRef = useRef(null);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); setShowInstall(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    const onUpdateAvailable = (e) => {
      updateHandlerRef.current = e.detail?.updateSW || null;
      setShowUpdate(true);
    };
    const onOfflineReady = () => setShowOfflineReady(true);
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);

    window.addEventListener('falc:pwa-update-available', onUpdateAvailable);
    window.addEventListener('falc:pwa-offline-ready', onOfflineReady);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('falc:pwa-update-available', onUpdateAvailable);
      window.removeEventListener('falc:pwa-offline-ready', onOfflineReady);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowInstall(false);
    setDeferredPrompt(null);
  };

  const handleUpdateApp = async () => {
    try {
      if (updateHandlerRef.current) {
        await updateHandlerRef.current(true);
      }
    } catch (e) {
      console.error('Error aplicando actualización PWA:', e);
    } finally {
      setShowUpdate(false);
      window.location.reload();
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="d-flex min-vh-100" style={{ background: 'var(--falc-bg)' }}>
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="sidebar-overlay show" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      {/* Sidebar */}
      <aside ref={sidebarRef}
        className={`falc-sidebar${sidebarOpen ? ' show' : ''}`}
        aria-label="Menú principal">
        <div className="text-center py-3 px-3" style={{ borderBottom: '1px solid var(--falc-border)' }}>
          <img
            src="/logo-falc.png"
            alt="FALC"
            style={{ width: '100%', maxWidth: 170, height: 'auto' }}
          />
        </div>
        <nav className="flex-grow-1 py-3">
          {menuItems.filter(item => tienePermiso(item.permiso)).map((item) => (
            <Link key={item.path} to={item.path}
              className={`nav-link${location.pathname === item.path ? ' active' : ''}`}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="px-3 py-3" style={{ borderTop: '1px solid var(--falc-border)' }}>
          <div className="small text-muted mb-1">{admin?.nombre || admin?.username}</div>
          {admin?.rol && <div className="small mb-2"><span className="badge bg-light text-dark">{admin.rol}</span></div>}
          <button onClick={handleLogout} className="btn btn-falc btn-sm w-100">Cerrar Sesión</button>
        </div>
      </aside>

      {/* Contenedor principal */}
      <div className="d-flex flex-column flex-grow-1" style={{ minWidth: 0 }}>
        {/* Topbar mobile */}
        <div className="mobile-topbar">
          <button className="btn btn-link text-dark p-1 fs-4" onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Abrir menú" aria-expanded={sidebarOpen}>
            {sidebarOpen ? '✕' : '☰'}
          </button>
          <img src="/logo-falc.png" alt="FALC" style={{ height: 24, width: 'auto' }} />
          <span className="ms-auto small text-muted text-truncate" style={{ maxWidth: 120 }}>
            {menuItems.find(m => m.path === location.pathname)?.label || ''}
          </span>
        </div>

        {/* Contenido */}
        <main className="falc-main">{children}</main>
      </div>

      {/* PWA Install Banner */}
      {showInstall && (
        <div id="pwa-install-banner" className="show">
          <span>📲 Instalar FALC como app</span>
          <button onClick={handleInstall}>Instalar</button>
          <button className="pwa-dismiss" onClick={() => setShowInstall(false)} aria-label="Cerrar">✕</button>
        </div>
      )}

      {showUpdate && (
        <div id="pwa-update-banner" className="show">
          <span>Nueva versión disponible</span>
          <button onClick={handleUpdateApp}>Actualizar</button>
          <button className="pwa-dismiss" onClick={() => setShowUpdate(false)} aria-label="Cerrar">✕</button>
        </div>
      )}

      {showOfflineReady && !isOffline && (
        <div id="pwa-offline-banner" className="show">
          <span>Modo offline listo</span>
          <button className="pwa-dismiss" onClick={() => setShowOfflineReady(false)} aria-label="Cerrar">✕</button>
        </div>
      )}

      {isOffline && (
        <div id="pwa-connection-banner" className="show offline">
          <span>Sin conexión. Usando caché local.</span>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="falc-bottom-nav" aria-label="Navegación principal">
        <Link to="/" className={`bn-item${location.pathname === '/' ? ' active' : ''}`}>
          <span className="bn-icon">
            <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
            </svg>
          </span><span>Dashboard</span>
        </Link>
        <Link to="/tickets" className={`bn-item${location.pathname === '/tickets' ? ' active' : ''}`}>
          <span className="bn-icon">
            <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </span><span>Tickets</span>
        </Link>
        <Link to="/transportes" className={`bn-item${location.pathname === '/transportes' ? ' active' : ''}`}>
          <span className="bn-icon">
            <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </span><span>Transportes</span>
        </Link>
        <Link to="/whatsapp" className={`bn-item${location.pathname === '/whatsapp' ? ' active' : ''}`}>
          <span className="bn-icon">
            <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </span><span>WhatsApp</span>
        </Link>
        <button className="bn-item" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú completo">
          <span className="bn-icon">
            <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </span><span>Más</span>
        </button>
      </nav>
    </div>
  );
}
