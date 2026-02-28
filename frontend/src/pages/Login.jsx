// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      {/* ===== PANEL IZQUIERDO - Imagen ===== */}
      <div style={{
        flex: '0 0 70%', position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'stretch',
      }}>
        {/* Imagen de fondo */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'url(https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1400&q=80)',
          backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
        {/* Overlay oscuro */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(15,52,96,0.7) 0%, rgba(26,26,46,0.5) 100%)',
        }} />
        {/* Logo sobre la imagen */}
        <div style={{ position: 'relative', zIndex: 2, padding: '40px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, border: '1px solid rgba(255,255,255,0.2)',
            }}>🚛</div>
            <div>
              <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: 1.5, lineHeight: 1 }}>FALC</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>Logística de Carga</div>
            </div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.85)', maxWidth: 460, marginBottom: 40 }}>
            <h2 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 12px', lineHeight: 1.2 }}>
              Gestiona tu logística de forma inteligente
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0, color: 'rgba(255,255,255,0.65)' }}>
              Automatiza solicitudes de transporte, cotizaciones y asignación de choferes desde un solo lugar.
            </p>
          </div>
        </div>
      </div>

      {/* ===== PANEL DERECHO - Formulario ===== */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        background: '#fff', padding: '40px 24px', position: 'relative',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Logo + Título */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
              background: 'linear-gradient(135deg, #0f3460, #1a1a2e)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 32, boxShadow: '0 8px 24px rgba(15,52,96,0.3)',
            }}>🚛</div>
            <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 700, color: '#1a1a2e' }}>Bienvenido</h1>
            <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>Ingresa tus credenciales para acceder</p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: '#fef2f2', color: '#dc2626', padding: '12px 16px', borderRadius: 10,
              marginBottom: 20, fontSize: 13, border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Campo Usuario */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#374151' }}>
                Usuario
              </label>
              <input
                type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                required placeholder="tu@email.com" autoComplete="username"
                style={{
                  width: '100%', padding: '12px 16px', border: '1.5px solid #e5e7eb', borderRadius: 10,
                  fontSize: 14, boxSizing: 'border-box', transition: 'all 0.2s',
                  background: '#f9fafb', outline: 'none',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Campo Contraseña */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#374151' }}>
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required placeholder="••••••••" autoComplete="current-password"
                  style={{
                    width: '100%', padding: '12px 48px 12px 16px', border: '1.5px solid #e5e7eb', borderRadius: 10,
                    fontSize: 14, boxSizing: 'border-box', transition: 'all 0.2s',
                    background: '#f9fafb', outline: 'none',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; e.target.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4, fontSize: 18,
                    color: '#9ca3af', display: 'flex', alignItems: 'center',
                  }}
                  title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="remember" checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#3b82f6', cursor: 'pointer' }}
              />
              <label htmlFor="remember" style={{ fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>
                Mantener mi sesión iniciada
              </label>
            </div>

            {/* Botón login */}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px 20px',
              background: loading ? '#93c5fd' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600,
              cursor: loading ? 'default' : 'pointer', transition: 'all 0.2s',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(37,99,235,0.35)',
              letterSpacing: 0.3,
            }}
              onMouseEnter={(e) => { if (!loading) e.target.style.boxShadow = '0 6px 20px rgba(37,99,235,0.45)'; }}
              onMouseLeave={(e) => { if (!loading) e.target.style.boxShadow = '0 4px 12px rgba(37,99,235,0.35)'; }}
            >
              {loading ? 'Ingresando...' : 'Iniciar Sesión'}
            </button>
          </form>

          {/* Separador */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '28px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
              FALC Logística © {new Date().getFullYear()} — Todos los derechos reservados
            </p>
          </div>
        </div>

        {/* Responsive: ocultar imagen en mobile se maneja con media query inline */}
      </div>

      {/* CSS para responsive */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="flex: 0 0 58%"] {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
