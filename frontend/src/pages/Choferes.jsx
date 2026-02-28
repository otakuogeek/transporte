// src/pages/Choferes.jsx
import { useState, useEffect } from 'react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';

export default function Choferes() {
  const [choferes, setChoferes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nombre: '', telefono_whatsapp: '', estado: 'Disponible' });

  useEffect(() => { loadChoferes(); }, []);

  async function loadChoferes() {
    try {
      const res = await api.get('/choferes');
      setChoferes(res.data);
    } catch (err) {
      console.error('Error cargando choferes:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(row) {
    setEditing(row);
    setForm({ nombre: row.nombre, telefono_whatsapp: row.telefono_whatsapp, estado: row.estado });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/choferes/${editing.id}`, form);
      } else {
        await api.post('/choferes', form);
      }
      setShowForm(false);
      setEditing(null);
      setForm({ nombre: '', telefono_whatsapp: '', estado: 'Disponible' });
      loadChoferes();
    } catch (err) {
      alert(err.response?.data?.error || 'Error guardando chofer');
    }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este chofer?')) return;
    try {
      await api.delete(`/choferes/${id}`);
      loadChoferes();
    } catch (err) {
      alert(err.response?.data?.error || 'Error eliminando chofer');
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Cargando...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: '#1a1a2e' }}>🚛 Choferes</h1>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm({ nombre: '', telefono_whatsapp: '', estado: 'Disponible' }); }}
          style={{ background: '#e94560', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
          + Nuevo Chofer
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 24, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 16px' }}>{editing ? 'Editar Chofer' : 'Nuevo Chofer'}</h3>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Nombre</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required
                style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>WhatsApp</label>
              <input value={form.telefono_whatsapp} onChange={(e) => setForm({ ...form, telefono_whatsapp: e.target.value })} required
                placeholder="573001234567" style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Estado</label>
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}
                style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box' }}>
                <option value="Disponible">Disponible</option>
                <option value="En Viaje">En Viaje</option>
                <option value="Inactivo">Inactivo</option>
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
          { key: 'nombre', label: 'Nombre' },
          { key: 'telefono_whatsapp', label: 'WhatsApp' },
          { key: 'estado', label: 'Estado', render: (v) => <StatusBadge status={v} /> },
          { key: 'vehiculos_placas', label: 'Placas', render: (v) => v || '-' },
          { key: 'vehiculos_tipos', label: 'Vehículos', render: (v) => v || '-' },
          { key: 'fecha_registro', label: 'Registro', render: (v) => new Date(v).toLocaleDateString('es-PE') },
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
        data={choferes}
      />
    </div>
  );
}
