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
      setVehiculos(vRes.data); setChoferes(chRes.data);
    } catch (err) { console.error('Error cargando datos:', err); }
    finally { setLoading(false); }
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
      if (editing) await api.put(`/vehiculos/${editing.id}`, payload);
      else await api.post('/vehiculos', payload);
      setShowForm(false); setEditing(null);
      setForm({ chofer_id: '', placa: '', tipo_vehiculo: '', capacidad_toneladas: '' });
      loadData();
    } catch (err) { alert(err.response?.data?.error || 'Error guardando vehículo'); }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este vehículo?')) return;
    try { await api.delete(`/vehiculos/${id}`); loadData(); }
    catch (err) { alert(err.response?.data?.error || 'Error eliminando vehículo'); }
  }

  if (loading) return <div className="text-center text-muted p-5">Cargando...</div>;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h5 fw-semibold mb-0">Vehículos</h1>
        <button className="btn btn-falc btn-sm" onClick={() => { setShowForm(true); setEditing(null); setForm({ chofer_id: '', placa: '', tipo_vehiculo: '', capacidad_toneladas: '' }); }}>
          Nuevo Vehículo
        </button>
      </div>

      {showForm && (
        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <h6 className="fw-bold mb-3">{editing ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h6>
            <form onSubmit={handleSubmit}>
              <div className="row g-3 mb-3">
                <div className="col-md-3">
                  <label className="form-label fw-semibold small">Placa</label>
                  <input className="form-control" value={form.placa} onChange={e => setForm({ ...form, placa: e.target.value })} required placeholder="ABC-123" />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold small">Tipo</label>
                  <select className="form-select" value={form.tipo_vehiculo} onChange={e => setForm({ ...form, tipo_vehiculo: e.target.value })} required>
                    <option value="">Seleccionar...</option>
                    <option value="Furgón">Furgón</option>
                    <option value="Tractomula">Tractomula</option>
                    <option value="Camión 350">Camión 350</option>
                    <option value="Camioneta">Camioneta</option>
                    <option value="Turbo">Turbo</option>
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label fw-semibold small">Capacidad (Ton)</label>
                  <input type="number" step="0.01" className="form-control" value={form.capacidad_toneladas} onChange={e => setForm({ ...form, capacidad_toneladas: e.target.value })} />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold small">Chofer</label>
                  <select className="form-select" value={form.chofer_id} onChange={e => setForm({ ...form, chofer_id: e.target.value })}>
                    <option value="">Sin asignar</option>
                    {choferes.map(ch => <option key={ch.id} value={ch.id}>{ch.nombre}</option>)}
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
          { key: 'placa', label: 'Placa' },
          { key: 'tipo_vehiculo', label: 'Tipo' },
          { key: 'capacidad_toneladas', label: 'Cap. (Ton)', render: v => v ? `${v} T` : '-' },
          { key: 'chofer_nombre', label: 'Chofer', render: v => v || 'Sin asignar' },
          { key: 'chofer_estado', label: 'Estado Chofer', render: v => v ? <StatusBadge status={v} /> : '-' },
          {
            key: 'acciones', label: 'Acciones', render: (_, row) => (
              <div className="d-flex gap-1">
                <button className="btn btn-outline-primary btn-sm" onClick={e => { e.stopPropagation(); handleEdit(row); }}>Editar</button>
                <button className="btn btn-outline-danger btn-sm" onClick={e => { e.stopPropagation(); handleDelete(row.id); }}>Eliminar</button>
              </div>
            ),
          },
        ]}
        data={vehiculos}
      />
    </div>
  );
}
