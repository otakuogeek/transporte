// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('falc_token');
    const savedAdmin = localStorage.getItem('falc_admin');
    if (token && savedAdmin) {
      try {
        setAdmin(JSON.parse(savedAdmin));
      } catch (error) {
        console.error('Sesión local inválida, limpiando storage:', error);
        localStorage.removeItem('falc_token');
        localStorage.removeItem('falc_admin');
      }
    }
    setLoading(false);
  }, []);

  async function login(username, password) {
    const res = await api.post('/auth/login', { username, password });
    const { token, admin: adminData } = res.data;
    localStorage.setItem('falc_token', token);
    localStorage.setItem('falc_admin', JSON.stringify(adminData));
    setAdmin(adminData);
    return adminData;
  }

  function logout() {
    localStorage.removeItem('falc_token');
    localStorage.removeItem('falc_admin');
    setAdmin(null);
  }

  // Verifica si el usuario actual tiene acceso a una sección
  function tienePermiso(seccion) {
    if (!admin?.permisos) return true; // backwards compat: si no hay permisos, permitir todo
    return admin.permisos.includes(seccion);
  }

  return (
    <AuthContext.Provider value={{ admin, login, logout, loading, tienePermiso }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
