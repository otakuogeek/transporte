// src/pages/Configuracion.jsx
import { useState, useEffect } from 'react';
import api from '../api/client';

export default function Configuracion() {
  const [params, setParams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});

  useEffect(() => { loadConfig(); }, []);

  async function loadConfig() {
    try { const res = await api.get('/configuracion'); setParams(res.data); }
    catch (err) { console.error('Error cargando configuración:', err); }
    finally { setLoading(false); }
  }

  async function handleSave(param) {
    setSaving({ ...saving, [param.nombre_parametro]: true });
    try {
      await api.put(`/configuracion/${param.nombre_parametro}`, { valor: param.valor });
      alert('Configuración guardada correctamente');
    } catch (err) { alert(err.response?.data?.error || 'Error guardando configuración'); }
    finally { setSaving({ ...saving, [param.nombre_parametro]: false }); }
  }

  function updateValue(index, valor) {
    const updated = [...params]; updated[index].valor = valor; setParams(updated);
  }

  if (loading) return <div className="text-center text-muted p-5">Cargando...</div>;

  return (
    <div>
      <h1 className="h5 fw-semibold mb-3">Configuración del Sistema</h1>

      <div className="card shadow-sm" style={{ maxWidth: 600 }}>
        <div className="card-body">
          {params.map((param, index) => (
            <div key={param.id} className={index < params.length - 1 ? 'mb-3 pb-3 border-bottom' : ''}>
              <label className="form-label fw-semibold small mb-1">
                {param.nombre_parametro.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </label>
              <p className="text-muted mb-2" style={{ fontSize: 12 }}>{param.descripcion}</p>
              <div className="d-flex gap-2">
                <input className="form-control form-control-sm" type="text" value={param.valor}
                  onChange={e => updateValue(index, e.target.value)}
                  placeholder={param.nombre_parametro === 'destino_unico' ? 'Ej: Bogotá, Centro de Acopio' : ''} />
                <button className="btn btn-falc btn-sm flex-shrink-0"
                  onClick={() => handleSave(param)} disabled={saving[param.nombre_parametro]}>
                  {saving[param.nombre_parametro] ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
