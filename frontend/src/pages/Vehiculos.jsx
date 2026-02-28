// src/pages/Vehiculos.jsx
import { useState, useEffect } from 'react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';

export default function Vehiculos() {
  const [vehiculos, setVehiculos] = useState([]);
  const [choferes, setChoferes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ chofer_id: '', placa: '', tipo_vehiculo: '', capacidad_toneladas: '' });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [vRes, chRes] = await Promise.all([api.get('/vehiculos'), api.get('/choferes')]);
      setVehiculos(vRes.data);
      setChoferes(chRes.data);
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(row) {
    setEditing(row);
    setForm({ chofer_id: row.chofer_id || '', placa: row.placa, tipo_vehiculo: row.tipo_vehiculo, capacidad_toneladas: row.capacidad_toneladas || '' });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = { ...form, chofer_id: form.chofer_id || null, capacidad_toneladas: form.capacidad_toneladas || null };
      if (editing) {
        await api.put(`/vehiculos/${editing.id}`, payload);
      } else {
        await api.post('/vehiculos', payload);
      }
      setShowForm(false);
      setEditing(null);
      setForm({ chofer_id: '', placa: '', tipo_vehiculo: '', capacidad_toneladas: '' });
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Error guardando vehículo');
    }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este vehículo?')) return;
    try {
      await api.delete(`/vehiculos/${id}`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Error eliminando vehículo');
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Cargando...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: '#1a1a2e' }}>🚗 Vehículos</h1>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm({ chofer_id: '', placa: '', tipo_vehiculo: '', capacidad_toneladas: '' }); }}
          style={{ background: '#e94560', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
          + Nuevo Vehículo
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 24, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 16px' }}>{editing ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h3>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Placa</label>
              <input value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value })} required
                placeholder="ABC-123" style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Tipo</label>
              <select value={form.tipo_vehiculo} onChange={(e) => setForm({ ...form, tipo_vehiculo: e.target.value })} required
                style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box' }}>
                <option value="">Seleccionar...</option>
                <option value="Furgón">Furgón</option>
                <option value="Tractomula">Tractomula</option>
                <option value="Camión 350">Camión 350</option>
                <option value="Camioneta">Camioneta</option>
                <option value="Turbo">Turbo</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Capacidad (Ton)</label>
              <input type="number" step="0.01" value={form.capacidad_toneladas} onChange={(e) => setForm({ ...form, capacidad_toneladas: e.target.value })}
                style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Chofer</label>
              <select value={form.chofer_id} onChange={(e) => setForm({ ...form, chofer_id: e.target.value })}
                style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box' }}>
                <option value="">Sin asignar</option>
                {choferes.map((ch) => (
                  <option key={ch.id} value={ch.id}>{ch.nombre}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={{ background: '#4caf50', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer' }}>
                Guardar
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ background: '#999', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <DataTable
        columns={[
          { key: 'id', label: '#' },
          { key: 'placa', label: 'Placa' },
          { key: 'tipo_vehiculo', label: 'Tipo' },
          { key: 'capacidad_toneladas', label: 'Capacidad (Ton)', render: (v) => v ? `${v} T` : '-' },
          { key: 'chofer_nombre', label: 'Chofer', render: (v) => v || 'Sin asignar' },
          { key: 'chofer_estado', label: 'Estado Chofer', render: (v) => v ? <StatusBadge status={v} /> : '-' },
          {
            key: 'acciones', label: 'Acciones', render: (_, row) => (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
                  style={{ background: '#1565c0', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Editar</button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
                  style={{ background: '#c62828', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Eliminar</button>
              </div>
            ),
          },
        ]}
        data={vehiculos}
      />
    </div>
  );
}
