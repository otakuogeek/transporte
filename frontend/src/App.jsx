// src/App.jsx - Aplicación principal con enrutamiento
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Configuracion from './pages/Configuracion';
import WhatsApp from './pages/WhatsApp';
import Tickets from './pages/Tickets';
import Transportes from './pages/Transportes';

function ProtectedRoute({ children }) {
  const { admin, loading } = useAuth();
  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Cargando...</div>;
  if (!admin) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
          <Route path="/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
          <Route path="/transportes" element={<ProtectedRoute><Transportes /></ProtectedRoute>} />
          <Route path="/configuracion" element={<ProtectedRoute><Configuracion /></ProtectedRoute>} />
          <Route path="/whatsapp" element={<ProtectedRoute><WhatsApp /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
