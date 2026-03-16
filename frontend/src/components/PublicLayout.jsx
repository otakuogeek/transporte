// src/components/PublicLayout.jsx — Layout compartido para páginas públicas (legal)
import { Link, useLocation } from 'react-router-dom';

const navLinks = [
  { path: '/politica-privacidad', label: 'Privacidad' },
  { path: '/terminos-servicio', label: 'Términos' },
  { path: '/eliminacion-datos', label: 'Eliminación de datos' },
];

export default function PublicLayout({ children, titulo, subtitulo, icono }) {
  const location = useLocation();
  const year = new Date().getFullYear();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f6f8fb', fontFamily: "'Inter','Segoe UI',system-ui,-apple-system,sans-serif" }}>

      {/* ===== HEADER ===== */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 64, flexWrap: 'wrap', gap: 8 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/favicon-falc.jpg" alt="FALC" style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover' }} />
            <span style={{ fontWeight: 700, fontSize: 18, color: '#1a1a2e', letterSpacing: -0.3 }}>FALC Logística</span>
          </Link>
          <nav style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {navLinks.map(l => (
              <Link key={l.path} to={l.path} style={{
                fontSize: 12, fontWeight: location.pathname === l.path ? 600 : 400,
                color: location.pathname === l.path ? '#2356a8' : '#6b7280',
                textDecoration: 'none', padding: '5px 8px', borderRadius: 8,
                background: location.pathname === l.path ? '#eef4ff' : 'transparent',
                transition: 'all .15s', whiteSpace: 'nowrap',
              }}>
                {l.label}
              </Link>
            ))}
            <Link to="/login" style={{
              fontSize: 13, fontWeight: 600, color: '#fff', textDecoration: 'none',
              padding: '6px 16px', borderRadius: 8, background: '#2356a8',
              marginLeft: 4,
            }}>
              Ingresar
            </Link>
          </nav>
        </div>
      </header>

      {/* ===== HERO / PORTADA ===== */}
      <section style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #0f3460 0%, #1a1a2e 100%)', color: '#fff' }}>
        {/* Patrón decorativo */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.06, backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M30 0L60 30 30 60 0 30z\' fill=\'%23fff\' fill-opacity=\'.4\'/%3E%3C/svg%3E")', backgroundSize: '60px 60px' }} />
        <div style={{ position: 'relative', maxWidth: 1100, margin: '0 auto', padding: '48px 20px 40px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
            {icono}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{titulo}</h1>
            {subtitulo && <p style={{ margin: '6px 0 0', fontSize: 15, opacity: 0.7, lineHeight: 1.5 }}>{subtitulo}</p>}
          </div>
        </div>
        {/* Onda inferior */}
        <svg viewBox="0 0 1440 60" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 40 }}>
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,60 L0,60Z" fill="#f6f8fb" />
        </svg>
      </section>

      {/* ===== CONTENIDO ===== */}
      <main style={{ flex: 1, maxWidth: 1100, width: '100%', margin: '0 auto', padding: '0 20px 48px' }}>
        {children}
      </main>

      {/* ===== FOOTER ===== */}
      <footer style={{ background: '#1a1a2e', color: 'rgba(255,255,255,0.6)', fontSize: 13, padding: '32px 20px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/favicon-falc.jpg" alt="FALC" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover' }} />
            <span style={{ fontWeight: 600, color: '#fff' }}>FALC Logística</span>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {navLinks.map(l => (
              <Link key={l.path} to={l.path} style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 13 }}>
                {l.label}
              </Link>
            ))}
          </div>
          <span>© {year} FALC — Todos los derechos reservados</span>
        </div>
      </footer>
    </div>
  );
}
