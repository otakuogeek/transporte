// src/App.jsx - Aplicación principal con enrutamiento
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import NotificadorTickets from './components/NotificadorTickets';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Configuracion from './pages/Configuracion';
import WhatsApp from './pages/WhatsApp';
import Tickets from './pages/Tickets';
import Transportes from './pages/Transportes';
import TiposVehiculos from './pages/TiposVehiculos';
import Liquidaciones from './pages/Liquidaciones';
import Usuarios from './pages/Usuarios';

function ProtectedRoute({ children, permiso }) {
  const { admin, loading, tienePermiso } = useAuth();
  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Cargando...</div>;
  if (!admin) return <Navigate to="/login" replace />;
  if (permiso && !tienePermiso(permiso)) return <Navigate to="/" replace />;
  return <Layout><NotificadorTickets />{children}</Layout>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute permiso="dashboard"><Dashboard /></ProtectedRoute>} />
          <Route path="/clientes" element={<ProtectedRoute permiso="clientes"><Clientes /></ProtectedRoute>} />
          <Route path="/tickets" element={<ProtectedRoute permiso="tickets"><Tickets /></ProtectedRoute>} />
          <Route path="/transportes" element={<ProtectedRoute permiso="transportes"><Transportes /></ProtectedRoute>} />
          <Route path="/tipos-vehiculos" element={<ProtectedRoute permiso="tipos-vehiculos"><TiposVehiculos /></ProtectedRoute>} />
          <Route path="/liquidaciones" element={<ProtectedRoute permiso="liquidaciones"><Liquidaciones /></ProtectedRoute>} />
          <Route path="/usuarios" element={<ProtectedRoute permiso="usuarios"><Usuarios /></ProtectedRoute>} />
          <Route path="/configuracion" element={<ProtectedRoute permiso="configuracion"><Configuracion /></ProtectedRoute>} />
          <Route path="/whatsapp" element={<ProtectedRoute permiso="whatsapp"><WhatsApp /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
