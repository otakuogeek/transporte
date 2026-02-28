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
      setAdmin(JSON.parse(savedAdmin));
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

  return (
    <AuthContext.Provider value={{ admin, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
