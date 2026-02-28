// src/pages/Configuracion.jsx
import { useState, useEffect } from 'react';
import api from '../api/client';

export default function Configuracion() {
  const [params, setParams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});

  useEffect(() => { loadConfig(); }, []);

  async function loadConfig() {
    try {
      const res = await api.get('/configuracion');
      setParams(res.data);
    } catch (err) {
      console.error('Error cargando configuración:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(param) {
    setSaving({ ...saving, [param.nombre_parametro]: true });
    try {
      await api.put(`/configuracion/${param.nombre_parametro}`, { valor: param.valor });
      alert('Configuración guardada correctamente');
    } catch (err) {
      alert(err.response?.data?.error || 'Error guardando configuración');
    } finally {
      setSaving({ ...saving, [param.nombre_parametro]: false });
    }
  }

  function updateValue(index, valor) {
    const updated = [...params];
    updated[index].valor = valor;
    setParams(updated);
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Cargando...</div>;

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: 22, color: '#1a1a2e' }}>⚙️ Configuración del Sistema</h1>

      <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', maxWidth: 600 }}>
        {params.map((param, index) => (
          <div key={param.id} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: index < params.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 600, color: '#333' }}>
              {param.nombre_parametro.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </label>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#888' }}>{param.descripcion}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={param.valor}
                onChange={(e) => updateValue(index, e.target.value)}
                placeholder={param.nombre_parametro === 'destino_unico' ? 'Ej: Bogotá, Centro de Acopio' : ''}
                style={{ flex: 1, padding: 8, border: '1px solid #ddd', borderRadius: 4, fontSize: 14 }}
              />
              <button
                onClick={() => handleSave(param)}
                disabled={saving[param.nombre_parametro]}
                style={{ background: '#4caf50', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                {saving[param.nombre_parametro] ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
