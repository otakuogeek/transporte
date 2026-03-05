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
    try { const res = await api.get('/choferes'); setChoferes(res.data); }
    catch (err) { console.error('Error cargando choferes:', err); }
    finally { setLoading(false); }
  }

  function handleEdit(row) {
    setEditing(row);
    setForm({ nombre: row.nombre, telefono_whatsapp: row.telefono_whatsapp, estado: row.estado });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editing) await api.put(`/choferes/${editing.id}`, form);
      else await api.post('/choferes', form);
      setShowForm(false); setEditing(null);
      setForm({ nombre: '', telefono_whatsapp: '', estado: 'Disponible' });
      loadChoferes();
    } catch (err) { alert(err.response?.data?.error || 'Error guardando chofer'); }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este chofer?')) return;
    try { await api.delete(`/choferes/${id}`); loadChoferes(); }
    catch (err) { alert(err.response?.data?.error || 'Error eliminando chofer'); }
  }

  if (loading) return <div className="text-center text-muted p-5">Cargando...</div>;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h5 fw-semibold mb-0">Choferes</h1>
        <button className="btn btn-falc btn-sm" onClick={() => { setShowForm(true); setEditing(null); setForm({ nombre: '', telefono_whatsapp: '', estado: 'Disponible' }); }}>
          Nuevo Chofer
        </button>
      </div>

      {showForm && (
        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <h6 className="fw-bold mb-3">{editing ? 'Editar Chofer' : 'Nuevo Chofer'}</h6>
            <form onSubmit={handleSubmit}>
              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <label className="form-label fw-semibold small">Nombre</label>
                  <input className="form-control" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold small">WhatsApp</label>
                  <input className="form-control" value={form.telefono_whatsapp} onChange={e => setForm({ ...form, telefono_whatsapp: e.target.value })} required placeholder="573001234567" />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold small">Estado</label>
                  <select className="form-select" value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
                    <option value="Disponible">Disponible</option>
                    <option value="En Viaje">En Viaje</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>
                <div className="col-md-1 d-flex align-items-end gap-1">
                  <button type="submit" className="btn btn-falc btn-sm">Guardar</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>✕</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <DataTable
        columns={[
          { key: 'id', label: '#' },
          { key: 'nombre', label: 'Nombre' },
          { key: 'telefono_whatsapp', label: 'WhatsApp' },
          { key: 'estado', label: 'Estado', render: v => <StatusBadge status={v} /> },
          { key: 'vehiculos_placas', label: 'Placas', render: v => v || '-' },
          { key: 'vehiculos_tipos', label: 'Vehículos', render: v => v || '-' },
          { key: 'fecha_registro', label: 'Registro', render: v => new Date(v).toLocaleDateString('es-PE') },
          {
            key: 'acciones', label: 'Acciones', render: (_, row) => (
              <div className="d-flex gap-1">
                <button className="btn btn-outline-primary btn-sm" onClick={e => { e.stopPropagation(); handleEdit(row); }}>Editar</button>
                <button className="btn btn-outline-danger btn-sm" onClick={e => { e.stopPropagation(); handleDelete(row.id); }}>Eliminar</button>
              </div>
            ),
          },
        ]}
        data={choferes}
      />
    </div>
  );
}
