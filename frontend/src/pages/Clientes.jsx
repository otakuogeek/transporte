import { useState, useEffect } from 'react';
import api from '../api/client';
import DataTable from '../components/DataTable';

const emptyForm = () => ({ nombre: '', apellidos: '', telefonos: [''], origen_default: '', email: '' });

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());

  useEffect(() => { loadClientes(); }, []);

  async function loadClientes() {
    try {
      const res = await api.get('/clientes');
      setClientes(res.data);
    } catch (err) {
      console.error('Error cargando clientes:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleNuevo() {
    setEditing(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function handleEdit(row) {
    setEditing(row);
    const telefonos = Array.isArray(row.telefonos) && row.telefonos.length > 0
      ? row.telefonos
      : (row.telefono_whatsapp ? [row.telefono_whatsapp] : ['']);
    setForm({
      nombre: row.nombre || '',
      apellidos: row.apellidos || '',
      telefonos,
      origen_default: row.origen_default || '',
      email: row.email || '',
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      nombre: form.nombre,
      apellidos: form.apellidos,
      telefonos: form.telefonos.filter(t => t.trim() !== ''),
      origen_default: form.origen_default,
      email: form.email,
    };
    try {
      if (editing) {
        await api.put(`/clientes/${editing.id}`, payload);
      } else {
        await api.post('/clientes', payload);
      }
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm());
      loadClientes();
    } catch (err) {
      alert(err.response?.data?.error || 'Error guardando cliente');
    }
  }

  async function handleDelete(id) {
    const cliente = clientes.find(c => c.id === id);
    if (!confirm(`¿Eliminar al cliente "${cliente?.nombre || id}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/clientes/${id}`);
      loadClientes();
    } catch (err) {
      const msg = err.response?.data?.error || 'Error eliminando cliente';
      alert(msg);
    }
  }

  function setTelefono(index, value) {
    const arr = [...form.telefonos];
    arr[index] = value;
    setForm({ ...form, telefonos: arr });
  }

  function addTelefono() {
    setForm({ ...form, telefonos: [...form.telefonos, ''] });
  }

  function removeTelefono(index) {
    const arr = form.telefonos.filter((_, i) => i !== index);
    setForm({ ...form, telefonos: arr.length > 0 ? arr : [''] });
  }

  if (loading) return <p className="p-4 text-muted">Cargando...</p>;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 fw-semibold mb-0">Clientes</h1>
        <button onClick={handleNuevo} className="btn btn-falc btn-sm fw-semibold">Nuevo Cliente</button>
      </div>

      {showForm && (
        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <h6 className="fw-bold mb-3">{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</h6>
            <form onSubmit={handleSubmit}>
              {/* Nombre + Apellidos */}
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold small">Nombre *</label>
                  <input className="form-control" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    required placeholder="Ej: Carlos" />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold small">Apellidos *</label>
                  <input className="form-control" value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
                    required placeholder="Ej: Ramírez Gómez" />
                </div>
              </div>

              {/* WhatsApp multi */}
              <div className="mb-3">
                <label className="form-label fw-semibold small">Números WhatsApp *</label>
                {form.telefonos.map((tel, idx) => (
                  <div key={idx} className="d-flex gap-2 mb-2">
                    <input className="form-control flex-grow-1" value={tel} onChange={(e) => setTelefono(idx, e.target.value)}
                      required={idx === 0} placeholder="Ej: 573001234567" />
                    {form.telefonos.length > 1 && (
                      <button type="button" onClick={() => removeTelefono(idx)} className="btn btn-danger btn-sm px-2" title="Quitar número">×</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addTelefono}
                  className="btn btn-outline-secondary btn-sm" style={{ borderStyle: 'dashed' }}>
                  + Agregar número
                </button>
              </div>

              {/* Finca + Email */}
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold small">Finca / Origen</label>
                  <input className="form-control" value={form.origen_default} onChange={(e) => setForm({ ...form, origen_default: e.target.value })}
                    placeholder="Ej: Finca La Aurora" />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold small">Correo electrónico</label>
                  <input type="email" className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="Ej: cliente@correo.com" />
                </div>
              </div>

              {/* Acciones */}
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-success btn-sm fw-semibold">Guardar</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary btn-sm">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DataTable
        columns={[
          { key: 'id', label: '#' },
          {
            key: 'nombre', label: 'Nombre',
            render: (v, row) => <span className="fw-semibold">{v} {row.apellidos || ''}</span>,
          },
          {
            key: 'telefonos', label: 'WhatsApp',
            render: (v, row) => {
              const nums = Array.isArray(v) && v.length > 0 ? v : (row.telefono_whatsapp ? [row.telefono_whatsapp] : []);
              if (nums.length === 0) return <span className="text-muted">—</span>;
              return (
                <span>
                  {nums[0]}
                  {nums.length > 1 && (
                    <span className="badge bg-danger ms-1" style={{ fontSize: 11 }}>+{nums.length - 1}</span>
                  )}
                </span>
              );
            },
          },
          { key: 'origen_default', label: 'Finca/Origen', render: (v) => v || <span className="text-muted">—</span> },
          { key: 'email', label: 'Email', render: (v) => v || <span className="text-muted">—</span> },
          { key: 'total_solicitudes', label: 'Solicitudes' },
          { key: 'fecha_registro', label: 'Registro', render: (v) => new Date(v).toLocaleDateString('es-PE') },
          {
            key: 'acciones', label: 'Acciones', render: (_, row) => (
              <div className="d-flex gap-1">
                <button onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
                  className="btn btn-primary btn-sm" style={{ fontSize: 12 }}>Editar</button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
                  className="btn btn-danger btn-sm" style={{ fontSize: 12 }}>Eliminar</button>
              </div>
            ),
          },
        ]}
        data={clientes}
      />
    </div>
  );
}
