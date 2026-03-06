// src/pages/Login.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const IOS_INSTALL_HINT_KEY = 'falc_ios_pwa_hint_dismissed_at';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [installPlatform, setInstallPlatform] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isAndroid = /android/.test(userAgent);
      e.preventDefault();
      setDeferredPrompt(e);
      setInstallPlatform('android');
      if (isAndroid) setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/crios|fxios|edgios|opr\//.test(userAgent);
    const isMobile = isIOS || isAndroid;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const dismissedAt = parseInt(localStorage.getItem(IOS_INSTALL_HINT_KEY) || '0', 10);
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    const iosHintDismissed = dismissedAt > 0 && (Date.now() - dismissedAt) < threeDays;

    if (!isMobile || isStandalone) return;

    if (isIOS) {
      if (iosHintDismissed) return;
      setInstallPlatform(isSafari ? 'ios' : 'ios-open-safari');
      setShowInstall(true);
      return;
    }

    if (isAndroid && !deferredPrompt) {
      const t = setTimeout(() => {
        if (!window.matchMedia('(display-mode: standalone)').matches) {
          setInstallPlatform((prev) => prev || 'android-manual');
          setShowInstall(true);
        }
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [deferredPrompt]);

  useEffect(() => {
    const onInstalled = () => {
      setShowInstall(false);
      setDeferredPrompt(null);
      setInstallPlatform(null);
    };

    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

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

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowInstall(false);
    setDeferredPrompt(null);
  };

  const dismissInstallBanner = () => {
    if (installPlatform === 'ios' || installPlatform === 'ios-open-safari') {
      localStorage.setItem(IOS_INSTALL_HINT_KEY, String(Date.now()));
    }
    setShowInstall(false);
  };

  return (
    <div className="container-fluid vh-100 p-0">
      {showInstall && (
        <div id="pwa-install-banner" className="show">
          <span>
            {installPlatform === 'ios' && '📲 Instala FALC: Compartir → Añadir a pantalla de inicio'}
            {installPlatform === 'ios-open-safari' && '📲 Para instalar en iPhone/iPad, abre esta web en Safari y usa Compartir → Añadir a pantalla de inicio'}
            {installPlatform === 'android-manual' && '📲 Instala FALC desde el menú del navegador: “Instalar app” o “Añadir a pantalla de inicio”'}
            {(installPlatform === 'android' || !installPlatform) && '📲 Instalar FALC como app'}
          </span>
          {installPlatform === 'android' && deferredPrompt && (
            <button onClick={handleInstall}>Instalar</button>
          )}
          {(installPlatform === 'ios' || installPlatform === 'ios-open-safari' || installPlatform === 'android-manual') && (
            <button onClick={dismissInstallBanner}>Entendido</button>
          )}
          <button className="pwa-dismiss" onClick={dismissInstallBanner} aria-label="Cerrar">✕</button>
        </div>
      )}

      <div className="row g-0 h-100">
        {/* ===== PANEL IZQUIERDO — Imagen (oculto en móvil) ===== */}
        <div className="col-lg-7 d-none d-lg-flex position-relative overflow-hidden"
          style={{ background: '#0f3460' }}>
          <div className="position-absolute top-0 start-0 w-100 h-100"
            style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1400&q=80)',
              backgroundSize: 'cover', backgroundPosition: 'center' }} />
          <div className="position-absolute top-0 start-0 w-100 h-100"
            style={{ background: 'linear-gradient(135deg, rgba(15,52,96,0.7), rgba(26,26,46,0.5))' }} />
          <div className="position-relative d-flex flex-column justify-content-between w-100 p-5" style={{ zIndex: 2 }}>
            <div className="d-flex align-items-center gap-3">
              <img
                src="/favicon-falc.jpg"
                alt="FALC"
                style={{
                  width: 96,
                  height: 96,
                  objectFit: 'cover',
                  borderRadius: 18,
                }}
              />
            </div>
            <div className="mb-5" style={{ maxWidth: 460 }}>
              <h2 className="text-white fw-bold mb-3" style={{ fontSize: 32, lineHeight: 1.2 }}>
                Gestiona tu logística de forma inteligente
              </h2>
              <p className="text-white-50 mb-0" style={{ fontSize: 15, lineHeight: 1.6 }}>
                Automatiza solicitudes de transporte, cotizaciones y asignación de choferes desde un solo lugar.
              </p>
            </div>
          </div>
        </div>

        {/* ===== PANEL DERECHO — Formulario ===== */}
        <div className="col-12 col-lg-5 d-flex align-items-center justify-content-center bg-white p-4">
          <div style={{ width: '100%', maxWidth: 380 }}>
            {/* Logo + Título */}
            <div className="text-center mb-4">
              <img src="/favicon-falc.jpg" alt="FALC" className="mx-auto d-block mb-3" style={{ width: 92, height: 92, objectFit: 'cover', borderRadius: 16 }} />
              <h1 className="fw-bold mb-1" style={{ fontSize: 26, color: '#1a1a2e' }}>Bienvenido</h1>
              <p className="text-muted small mb-0">Ingresa tus credenciales para acceder</p>
            </div>

            {/* Error */}
            {error && (
              <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small" role="alert">
                <span>⚠️</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label fw-semibold small">Usuario</label>
                <input type="text" className="form-control form-control-lg" value={username}
                  onChange={(e) => setUsername(e.target.value)} required placeholder="tu@email.com" autoComplete="username" />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold small">Contraseña</label>
                <div className="input-group">
                  <input type={showPassword ? 'text' : 'password'} className="form-control form-control-lg"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    required placeholder="••••••••" autoComplete="current-password" />
                  <button className="btn btn-outline-secondary" type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Ocultar' : 'Mostrar'}>
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="form-check mb-4">
                <input className="form-check-input" type="checkbox" id="remember" checked={remember}
                  onChange={(e) => setRemember(e.target.checked)} />
                <label className="form-check-label small text-muted" htmlFor="remember">
                  Mantener mi sesión iniciada
                </label>
              </div>

              <button type="submit" className="btn btn-falc btn-lg w-100 fw-semibold" disabled={loading}
                style={{ border: 'none', boxShadow: loading ? 'none' : '0 4px 12px rgba(35,86,168,0.2)' }}>
                {loading ? 'Ingresando...' : 'Iniciar Sesión'}
              </button>
            </form>

            <hr className="my-4" />
            <p className="text-center text-muted mb-0" style={{ fontSize: 12 }}>
              FALC Logística © {new Date().getFullYear()} — Todos los derechos reservados
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
