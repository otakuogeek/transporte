import { useState, useEffect } from 'react';
import api from '../api/client';

export default function TiposVehiculos() {
  const [tipos, setTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '', capacidad_toneladas: '' });

  useEffect(() => { fetchTipos(); }, []);

  const fetchTipos = async () => {
    try { const { data } = await api.get('/tipos-vehiculos'); setTipos(data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const abrirModal = (t = null) => {
    if (t) { setEditando(t); setForm({ nombre: t.nombre, descripcion: t.descripcion || '', capacidad_toneladas: t.capacidad_toneladas || '' }); }
    else { setEditando(null); setForm({ nombre: '', descripcion: '', capacidad_toneladas: '' }); }
    setModalOpen(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim()) return alert('El nombre es requerido');
    try {
      const payload = { nombre: form.nombre, descripcion: form.descripcion || null, capacidad_toneladas: form.capacidad_toneladas ? parseFloat(form.capacidad_toneladas) : null };
      if (editando) await api.put(`/tipos-vehiculos/${editando.id}`, payload);
      else await api.post('/tipos-vehiculos', payload);
      setModalOpen(false); fetchTipos();
    } catch (e) { alert('Error guardando: ' + (e.response?.data?.error || e.message)); }
  };

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este tipo de vehículo?')) return;
    try { await api.delete(`/tipos-vehiculos/${id}`); fetchTipos(); }
    catch (e) { alert('Error eliminando: ' + (e.response?.data?.error || e.message)); }
  };

  if (loading) return <div className="text-center text-muted p-5">Cargando...</div>;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h5 fw-semibold mb-0">Tipos de Vehículos</h1>
        <button className="btn btn-falc btn-sm" onClick={() => abrirModal()}>Nuevo Tipo</button>
      </div>

      {tipos.length === 0 ? (
        <div className="card shadow-sm">
          <div className="card-body text-center text-muted py-5">No hay tipos de vehículos registrados</div>
        </div>
      ) : (
        <div className="row g-2">
          {tipos.map(t => (
            <div key={t.id} className="col-12 col-md-6 col-xl-4">
              <div className="card shadow-sm h-100">
                <div className="card-body p-3 d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start mb-2 gap-2">
                    <h6 className="fw-semibold mb-0 text-truncate" title={t.nombre}>{t.nombre}</h6>
                    <span className="badge rounded-pill bg-primary-subtle text-primary">
                      {t.capacidad_toneladas ? `${t.capacidad_toneladas} tn` : 'Sin capacidad'}
                    </span>
                  </div>

                  <div className="small text-muted mb-1">Descripción</div>
                  <div className="mb-3 text-muted" style={{ minHeight: 38 }}>{t.descripcion || '—'}</div>

                  <div className="d-flex gap-2 mt-auto">
                    <button className="btn btn-outline-primary btn-sm flex-fill" onClick={() => abrirModal(t)}>Editar</button>
                    <button className="btn btn-outline-danger btn-sm flex-fill" onClick={() => eliminar(t.id)}>Eliminar</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,.5)' }} onClick={() => setModalOpen(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editando ? 'Editar' : 'Nuevo'} Tipo de Vehículo</h5>
                <button className="btn-close" onClick={() => setModalOpen(false)} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-semibold small">Nombre *</label>
                  <input className="form-control" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Semi Remolque" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold small">Descripción</label>
                  <input className="form-control" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción breve" />
                </div>
                <div>
                  <label className="form-label fw-semibold small">Capacidad (Toneladas)</label>
                  <input type="number" step="0.01" min="0" className="form-control" value={form.capacidad_toneladas} onChange={e => setForm({ ...form, capacidad_toneladas: e.target.value })} placeholder="Ej: 30.00" />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button className="btn btn-success btn-sm" onClick={guardar}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
